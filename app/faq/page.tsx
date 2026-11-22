import { Accordion } from "@/components/accordion";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Frequently Asked Questions", description: "Answers about the initiative, eligibility, and how to help." };

const ITEMS = [
  { q: "What is the initiative's goal?", a: "To help Hindu temple communities in the United States make informed sugar choices and, when resources allow, connect eligible temples with donated vegan sugar for prasadam, offerings, festivals, and community meals." },
  { q: "What does vegan sugar mean for this initiative?", a: "For this initiative, we seek sugar documented as processed without animal-derived processing aids. Sugar-processing methods can vary by manufacturer and product. This initiative encourages temples to check product-specific labeling and manufacturer information when choosing sugar." },
  { q: "Are all products from one brand processed the same way?", a: "Not necessarily. Processing methods can vary by product, manufacturing facility, and time period. Check the specific product and package rather than assuming every product from a brand is processed the same way." },
  { q: "How can a temple check a specific product?", a: "Identify the exact product and manufacturer, look for explicit product-specific vegan labeling or documentation, contact the manufacturer if the information is unclear, keep the response and the date checked, and recheck when products or manufacturing information change. Our Choosing Sugar page includes a checklist and an inquiry template." },
  { q: "Who can request sugar?", a: "Authorized representatives of Hindu temples in the United States may submit a request through the Request Sugar form. The program is not for individual household requests." },
  { q: "Are donations guaranteed?", a: "No. A submitted request is not a confirmed delivery. Each request is reviewed individually, and fulfillment depends on approval, available resources, and confirmed delivery arrangements. Please wait for written approval and delivery arrangements." },
  { q: "Is delivery available everywhere?", a: "No. Our initial donation program supports selected temples, and delivery arrangements must be confirmed in advance. Temples should not rely on a donation before approval and coordination." },
  { q: "Can we request sugar for a festival?", a: "Yes. Select Festival or event as an intended use and share the date you need the sugar by. Festival requests follow the same review process and are not guaranteed." },
  { q: "Can individuals request sugar?", a: "No. This program serves Hindu temples and their authorized representatives, not individual households." },
  { q: "How can I help?", a: "You can offer suitable sugar, help coordinate deliveries, introduce the initiative to your temple, or volunteer. Use the Support page to describe how you would like to help. Please contact us before purchasing or shipping sugar so suitability, quantities, and delivery can be confirmed." },
  { q: "Does outreach mean a temple is a partner?", a: "No. Contacting a temple or receiving an inquiry does not establish affiliation, endorsement, or partnership. Participation and fulfillment are subject to confirmation." },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>FAQ</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Questions and answers.</h1>
      <p className="mt-4 text-lg text-[#4A4238]">Respectful, practical answers about eligibility, process, and limits.</p>
      <div className="mt-8"><Accordion items={ITEMS} /></div>
    </div>
  );
}
