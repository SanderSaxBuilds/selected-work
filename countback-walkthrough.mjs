export const walkthroughSteps = [
  {
    text: "Five cartons of oat milk, no loose bottles. Two bottles are damaged.",
    sku: "OAT",
    cartons: 5,
    loose: 0,
    damaged: 2,
    reply: "60 bottles received, including two damaged. That is 12 bottles short."
  },
  {
    text: "Correction: six cartons of oat milk, not five. Two damaged remain.",
    sku: "OAT",
    cartons: 6,
    loose: 0,
    damaged: 2,
    reply: "Corrected to 72 bottles received. Two damaged, 70 usable. The earlier count stays in history."
  },
  {
    text: "Four cartons of coffee beans. No loose bags, none damaged.",
    sku: "COFFEE",
    cartons: 4,
    loose: 0,
    damaged: 0,
    reply: "24 bags of coffee. The count matches the order."
  },
  {
    text: "Four cartons of paper cups and five loose sleeves. None damaged.",
    sku: "CUPS",
    cartons: 4,
    loose: 5,
    damaged: 0,
    reply: "45 sleeves received. Five short. All three products are checked."
  }
];
