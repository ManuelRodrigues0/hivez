export interface Community {
  id: string;
  name: string;
  icon: string;
}

export const COMMUNITIES: Community[] = [
  {
    id: "lost-pets",
    name: "Lost Pets",
    icon: "🐶",
  },
  {
    id: "waste",
    name: "Waste & Garbage",
    icon: "🗑️",
  },
  {
    id: "water-leakage",
    name: "Water Leakage",
    icon: "🚰",
  },
  {
    id: "roads",
    name: "Roads & Potholes",
    icon: "🛣️",
  },
  {
    id: "street-lights",
    name: "Street Lights",
    icon: "💡",
  },
  {
    id: "illegal-parking",
    name: "Illegal Parking",
    icon: "🚗",
  },
  {
    id: "fallen-trees",
    name: "Fallen Trees",
    icon: "🌳",
  },
  {
    id: "electric-hazards",
    name: "Electric Hazards",
    icon: "⚡",
  },
  {
    id: "blood-requests",
    name: "Blood Requests",
    icon: "🩸",
  },
  {
    id: "missing-persons",
    name: "Missing Persons",
    icon: "👤",
  },
];