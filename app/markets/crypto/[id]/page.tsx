import { CryptoDetailExperience } from "@/components/markets/CryptoDetailExperience";

type PageProps = {
  params: { id: string };
};

export default function CryptoDetailPage({ params }: PageProps) {
  return <CryptoDetailExperience id={params.id} />;
}
