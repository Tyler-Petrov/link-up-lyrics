type Constant = {
    tag: string;
    name: string;
}

export const Keys = Object.freeze([
    { tag: "a", name: "A", accidentals: ["#", "b"] },
    { tag: "b", name: "B", accidentals: ["b"] },
    { tag: "c", name: "C", accidentals: ["#"] },
    { tag: "d", name: "D", accidentals: ["#", "b"] },
    { tag: "e", name: "E", accidentals: ["b"] },
    { tag: "f", name: "F", accidentals: ["#"] },
    { tag: "g", name: "G", accidentals: ["#", "b"] },
] as const satisfies (Constant & { accidentals: typeof Accidentals[number]['tag'][] })[]);

export const Accidentals = Object.freeze([
    { tag: "#", name: "Sharp" },
    { tag: "b", name: "Flat" },
] as const);