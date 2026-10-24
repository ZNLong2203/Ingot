import type { Metadata } from "next";
import { DemoApp } from "@/components/demo/DemoApp";

export const metadata: Metadata = {
  title: "Try the flow",
  description: "Read a Turkish mill's invoices with AI, calculate CBAM embedded emissions, sign and record them, ship, and declare — on a live EVM in your browser.",
};

export default function DemoPage() {
  return <DemoApp />;
}
