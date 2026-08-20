import { ImageResponse } from 'next/og';
import { SocialCard } from '@/components/SocialCard';

export const alt = 'Saved You a Token — audit your LLM prompt costs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(<SocialCard />, size);
}
