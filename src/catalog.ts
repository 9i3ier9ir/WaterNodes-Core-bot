import { EmbedBuilder } from "discord.js";

export type Currency = "USD" | "INR";
export type PlanTerm = "monthly" | "yearly" | "lifetime";

type Plan = {
  tier: string;
  name: string;
  vcpu: number;
  ram: number;
  storage: number;
  bandwidth: number;
  prices: Record<Currency, Record<PlanTerm, string>>;
  effectiveMonthly: Record<Currency, string>;
};

export const plans: Plan[] = [
  {
    tier: "T1", name: "Starter", vcpu: 2, ram: 4, storage: 50, bandwidth: 4,
    prices: { USD: { monthly: "$2.49", yearly: "$23.90", lifetime: "$110" }, INR: { monthly: "₹209", yearly: "₹2,008", lifetime: "₹9,350" } },
    effectiveMonthly: { USD: "$1.99", INR: "₹167" },
  },
  {
    tier: "T2", name: "Standard", vcpu: 4, ram: 8, storage: 100, bandwidth: 8,
    prices: { USD: { monthly: "$4.99", yearly: "$47.90", lifetime: "$225" }, INR: { monthly: "₹415", yearly: "₹3,986", lifetime: "₹18,700" } },
    effectiveMonthly: { USD: "$3.99", INR: "₹332" },
  },
  {
    tier: "T3", name: "Professional", vcpu: 6, ram: 16, storage: 200, bandwidth: 12,
    prices: { USD: { monthly: "$9.99", yearly: "$95.90", lifetime: "$450" }, INR: { monthly: "₹829", yearly: "₹7,962", lifetime: "₹37,550" } },
    effectiveMonthly: { USD: "$7.99", INR: "₹664" },
  },
  {
    tier: "T4", name: "Enterprise", vcpu: 8, ram: 32, storage: 400, bandwidth: 20,
    prices: { USD: { monthly: "$17.49", yearly: "$167.90", lifetime: "$800" }, INR: { monthly: "₹1,449", yearly: "₹13,914", lifetime: "₹66,950" } },
    effectiveMonthly: { USD: "$13.99", INR: "₹1,160" },
  },
];

const termLabels: Record<PlanTerm, string> = {
  monthly: "Monthly",
  yearly: "Yearly (20% discount)",
  lifetime: "Lifetime (one-time)",
};

export function createPlanEmbeds(currency: Currency): EmbedBuilder[] {
  const hardware = new EmbedBuilder()
    .setColor(0x168a78)
    .setTitle("WaterNodes Core | Infrastructure")
    .setDescription(
      "AMD Ryzen 9 7950X / 9950X · up to 5.7 GHz boost\n" +
      "DDR5 ECC memory · Gen4 NVMe storage\n" +
      "1–10 Gbps port · US East, US West, Mumbai, or Delhi",
    )
    .setFooter({ text: `Prices in ${currency}` });

  const pricing = (["monthly", "yearly", "lifetime"] as const).map((term) => {
    const embed = new EmbedBuilder()
      .setColor(0x168a78)
      .setTitle(`${termLabels[term]} Plans`)
      .setFooter({ text: `WaterNodes Core · ${currency}` });

    for (const plan of plans) {
      const price = plan.prices[currency][term];
      const effective = term === "yearly"
        ? ` · ${plan.effectiveMonthly[currency]}/mo effective`
        : "";
      embed.addFields({
        name: `${plan.tier} · ${plan.name} · ${price}${term === "monthly" ? "/mo" : ""}${effective}`,
        value: `${plan.vcpu} vCPU · ${plan.ram} GB RAM · ${plan.storage} GB NVMe · ${plan.bandwidth} TB bandwidth`,
      });
    }
    return embed;
  });

  return [hardware, ...pricing];
}