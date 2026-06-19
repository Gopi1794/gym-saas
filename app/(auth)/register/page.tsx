import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import OwnerRegisterForm from "@/components/auth/register/OwnerRegisterForm"
import MemberRegisterForm from "@/components/auth/register/MemberRegisterForm"

interface Props {
  searchParams: { gym?: string }
}

async function fetchGym(gymCode: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("gyms")
    .select("name, logo_url")
    .eq("invite_code", gymCode)
    .single()
  return data
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const gymCode = searchParams.gym
  if (!gymCode) return { title: "Crear cuenta | Voltia" }

  const gym = await fetchGym(gymCode)
  const gymName = gym?.name ?? "Tu gym"
  const image = gym?.logo_url ?? "/logo-vector.png"

  return {
    title: `Únete a ${gymName} | Voltia`,
    description: `Registrate y empezá a entrenar en ${gymName}. Seguimiento de progreso, planes personalizados y más.`,
    openGraph: {
      title: `Únete a ${gymName}`,
      description: `${gymName} te invita a entrenar. Creá tu cuenta gratis.`,
      images: [{ url: image, width: 1200, height: 630, alt: gymName }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Únete a ${gymName}`,
      description: `${gymName} te invita a entrenar. Creá tu cuenta gratis.`,
      images: [image],
    },
  }
}

export default async function RegisterPage({ searchParams }: Props) {
  const gymCode = searchParams.gym

  if (!gymCode) {
    return <OwnerRegisterForm />
  }

  const gym = await fetchGym(gymCode)
  return <MemberRegisterForm gymCode={gymCode} gymName={gym?.name ?? null} />
}
