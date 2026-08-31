/* Temporary test harness: validates every Teachable Machine model in
   public/models by replaying the exact load + predict path used by
   src/services/teachableMachineService.ts under the @tensorflow/tfjs CPU backend. */
const fs = require("fs");
const path = require("path");
const tf = require("d:/hivez/node_modules/@tensorflow/tfjs");

async function main() {
  await tf.ready();
  console.log("Backend:", tf.getBackend());
  const modelsRoot = "d:/hivez/public/models";
  const modelDirs = fs
    .readdirSync(modelsRoot)
    .filter((d) => fs.existsSync(path.join(modelsRoot, d, "model.json")));
  console.log("Found", modelDirs.length, "models\n");

  let failures = 0;
  for (const dir of modelDirs) {
    const base = path.join(modelsRoot, dir);
    const modelJson = JSON.parse(fs.readFileSync(path.join(base, "model.json"), "utf8"));
    const metadata = JSON.parse(fs.readFileSync(path.join(base, "metadata.json"), "utf8"));
    const weightsBuf = fs.readFileSync(path.join(base, "weights.bin"));

    const manifests = modelJson.weightsManifest || [];
    let expectedBytes = 0;
    for (const manifest of manifests) {
      for (const w of manifest.weights) {
        const bytesPer = w.dtype === "float32" ? 4 : 2;
        expectedBytes += w.shape.reduce((a, b) => a * b, 1) * bytesPer;
      }
    }

    const ioHandler = {
      load: async () => ({
        modelTopology: modelJson.modelTopology,
        weightSpecs: manifests.flatMap((m) => m.weights),
        weightData: new Uint8Array(weightsBuf).buffer,
      }),
    };

    try {
      const model = await tf.loadLayersModel(ioHandler);
      const x = tf.zeros([1, 224, 224, 3]); // replicates image resized to 224x224, /255 (zeros here)
      const pred = model.predict(x);
      const values = Array.from(await pred.data());
      const shape = Array.isArray(pred.shape) ? pred.shape : pred.shape;
      const labels = metadata.labels || metadata.classNames || [];
      const softmaxSum = values.reduce((a, b) => a + b, 0);
      const finite = values.every(Number.isFinite);
      const weightBytesOk = expectedBytes === weightsBuf.length;
      const outputMatches = shape[shape.length - 1] === labels.length;
      const topIdx = values.indexOf(Math.max(...values));
      const ok = weightBytesOk && outputMatches && finite;

      console.log(
        `${ok ? "PASS" : "FAIL"} ${dir.padEnd(17)} out=${shape.join("x")} ` +
          `labels=${labels.length} bytes=${weightsBuf.length}/${expectedBytes} ` +
          `softmaxSum=${softmaxSum.toFixed(4)} finite=${finite} top="${labels[topIdx] || "?"}" ` +
          `topScore=${values[topIdx]?.toFixed(4)}`
      );
      model.dispose();
      x.dispose();
      pred.dispose();
      if (!ok) failures++;
    } catch (err) {
      console.log(`ERROR ${dir}: ${err.message}`);
      failures++;
    }
  }

  console.log(failures === 0 ? "\nALL MODELS PASS" : `\n${failures} MODEL(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});