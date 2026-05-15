"use client"

import dynamic from "next/dynamic"

const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false, loading: () => null }
)

interface Props {
  src: string
  autoplay?: boolean
  loop?: boolean
  style?: React.CSSProperties
}

export default function LottiePlayer({ src, autoplay = true, loop = false, style }: Props) {
  return <DotLottieReact src={src} autoplay={autoplay} loop={loop} style={style} />
}
