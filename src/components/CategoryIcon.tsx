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
  Bot,
  BrainCircuit,
  Sparkles,
  Cpu,
  MessageCircle,
  PenTool,
  Image,
  Music,
  Video,
  Camera,
  Palette,
  BookOpen,
  GraduationCap,
  FlaskConical,
  Database,
  Terminal,
  GitBranch,
  Layout,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Megaphone,
  Gamepad2,
  Plane,
  Home,
  Coffee,
  Laugh,
  Languages,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  // General
  folder: Folder,
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  tag: Tag,
  // AI
  bot: Bot,
  "brain-circuit": BrainCircuit,
  sparkles: Sparkles,
  cpu: Cpu,
  // Communication
  mail: Mail,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  // Writing & Creative
  "pen-tool": PenTool,
  "file-text": FileText,
  image: Image,
  music: Music,
  video: Video,
  camera: Camera,
  palette: Palette,
  // Learning & Research
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "flask-conical": FlaskConical,
  lightbulb: Lightbulb,
  // Dev & Tech
  code: Code,
  terminal: Terminal,
  database: Database,
  "git-branch": GitBranch,
  layout: Layout,
  // Business
  briefcase: Briefcase,
  "shopping-cart": ShoppingCart,
  "dollar-sign": DollarSign,
  "trending-up": TrendingUp,
  megaphone: Megaphone,
  // Lifestyle
  globe: Globe,
  plane: Plane,
  home: Home,
  coffee: Coffee,
  "gamepad-2": Gamepad2,
  laugh: Laugh,
  languages: Languages,
  // Utility
  zap: Zap,
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
