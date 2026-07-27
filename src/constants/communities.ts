export interface Community {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const COMMUNITIES: Community[] = [
  {
    id: "lost-pets",
    name: "Lost Pets",
    icon: "🐶",
    description: "Missing, found, and urgent local pet alerts.",
  },
  {
    id: "waste",
    name: "Waste & Garbage",
    icon: "🗑️",
    description: "Overflowing bins, illegal dumping, and cleanup reports.",
  },
  {
    id: "water-leakage",
    name: "Water Leakage",
    icon: "🚰",
    description: "Leaks, broken pipes, and water supply issues.",
  },
  {
    id: "roads",
    name: "Roads & Potholes",
    icon: "🛣️",
    description: "Damaged roads, potholes, and unsafe stretches.",
  },
  {
    id: "street-lights",
    name: "Street Lights",
    icon: "💡",
    description: "Broken lights, dark streets, and public lighting issues.",
  },
  {
    id: "illegal-parking",
    name: "Illegal Parking",
    icon: "🚗",
    description: "Blocked roads, entrances, and unsafe parking reports.",
  },
  {
    id: "fallen-trees",
    name: "Fallen Trees",
    icon: "🌳",
    description: "Fallen branches, blocked routes, and tree hazards.",
  },
  {
    id: "electric-hazards",
    name: "Electric Hazards",
    icon: "⚡",
    description: "Exposed wires, damaged poles, and electrical risks.",
  },
  {
    id: "blood-requests",
    name: "Blood Requests",
    icon: "🩸",
    description: "Urgent donation requests and community health support.",
  },
  {
    id: "missing-persons",
    name: "Missing Persons",
    icon: "👤",
    description: "Missing person alerts and verified local updates.",
  },
];
