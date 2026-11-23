import { Accordion } from "@/components/accordion";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Frequently Asked Questions", description: "Answers about sugar processing, product checks, sharing, and donation requests." };

const ITEMS = [
  { q: "Why does sugar processing matter to some vegetarian and vegan communities?", a: "Some cane-sugar refining uses bone char, a filtering aid made from animal bones, to remove color. Communities that avoid animal-derived processing aids may wish to choose sugar documented as processed without them. Sugar itself does not contain bone char as an ingredient; the concern is about how it was filtered." },
  { q: "Is bone char an ingredient in sugar?", a: "No. Bone char is a processing or filtering aid used in some refining, not an ingredient left in finished sugar. The question is whether animal-derived aids were used during processing, not whether sugar contains them." },
  { q: "Does every sugar product use the same processing method?", a: "No. Processing methods can vary by manufacturer and product, and can differ between facilities and time periods. Check the specific product and package rather than assuming every product from a brand is processed the same way." },
  { q: "How can I check a specific product?", a: "Identify the exact product and manufacturer, look for explicit product-specific vegan labeling or documentation, contact the manufacturer if the information is unclear, keep the response and the date checked, and recheck when products or manufacturing information change. Our Choosing-Sugar Guide includes a checklist and an inquiry template." },
  { q: "Can I rely on a retailer or brand name alone?", a: "No. A retailer stocks products from many manufacturers, and one brand can use different processes for different products. Always verify the exact manufacturer, product name, and package." },
  { q: "How can I share this message with my temple?", a: "Use the sharing tools on the homepage to send this page to temple volunteers, kitchen teams, family, and friends. Nothing is sent automatically; you choose where to share." },
  { q: "What does vegan sugar mean for this campaign?", a: "For this campaign, we seek sugar documented as processed without animal-derived processing aids. Sugar-processing methods can vary by manufacturer and product, so we encourage checking product-specific labeling and manufacturer information." },
  { q: "Can a temple request donated sugar?", a: "Authorized representatives of temples may submit a request through the Request Sugar form. The program is not for individual household requests. Each request is reviewed individually; donations and delivery are not guaranteed." },
  { q: "Is delivery available everywhere?", a: "No. Donation support depends on review, available resources, and confirmed delivery arrangements. Temples should not rely on a donation before written approval and coordination." },
  { q: "Can we request sugar for a festival?", a: "Yes. Select Festival or event as an intended use and share the date you need the sugar by. Festival requests follow the same review process and are not guaranteed." },
  { q: "How can I help?", a: "You can offer suitable sugar, help coordinate deliveries, introduce Temple Initiative to your temple, or volunteer. Use the Support page to describe how you would like to help. Please contact us before purchasing or shipping sugar so suitability, quantities, and delivery can be confirmed." },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>FAQ</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Questions and answers.</h1>
      <p className="mt-4 text-lg text-[#4A4238]">Processing facts first; donation logistics last.</p>
      <div className="mt-8"><Accordion items={ITEMS} /></div>
    </div>
  );
}
