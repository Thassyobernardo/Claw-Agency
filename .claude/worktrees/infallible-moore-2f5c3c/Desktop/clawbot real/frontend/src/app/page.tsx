import Hero        from "@/components/Hero";
import HowItWorks  from "@/components/HowItWorks";
import Pricing     from "@/components/Pricing";
import Showreel    from "@/components/Showreel";
import Contact     from "@/components/Contact";

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <Hero />
      <HowItWorks />
      <Showreel />
      <Pricing />
      <Contact />
    </main>
  );
}
