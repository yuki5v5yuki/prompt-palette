import type { LucideIcon } from "lucide-react";
import {
  Folder,
  Star,
  Heart,
  Bookmark,
  Tag,
  Code,
  FileText,
  Mail,
  MessageSquare,
  Briefcase,
  Globe,
  Zap,
  Lightbulb,
  Wrench,
  Users,
  Calendar,
  Shield,
  Rocket,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  tag: Tag,
  code: Code,
  "file-text": FileText,
  mail: Mail,
  "message-square": MessageSquare,
  briefcase: Briefcase,
  globe: Globe,
  zap: Zap,
  lightbulb: Lightbulb,
  wrench: Wrench,
  users: Users,
  calendar: Calendar,
  shield: Shield,
  rocket: Rocket,
};

export const PRESET_ICONS = Object.keys(ICON_MAP);

export function CategoryIcon({
  name,
  size,
  color,
}: {
  name: string;
  size: number;
  color?: string;
}) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) return null;
  return <IconComponent size={size} color={color} />;
}
