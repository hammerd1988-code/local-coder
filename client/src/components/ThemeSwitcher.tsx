import * as React from "react";
import { Palette } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ThemeSwitcherProps {
  theme: string;
  onThemeChange: (theme: string) => void;
}

export default function ThemeSwitcher({ theme, onThemeChange }: ThemeSwitcherProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-500/30 bg-gradient-to-r from-purple-950/20 to-cyan-950/20">
      <Palette className="w-4 h-4 text-cyan-400" />
      <Select value={theme} onValueChange={onThemeChange}>
        <SelectTrigger className="w-[180px] bg-black/40 border-cyan-500/50 text-cyan-100 hover:border-cyan-400 focus:ring-cyan-500">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent className="bg-gray-950 border-cyan-500/50">
          <SelectItem value="vs-dark" className="text-cyan-100 hover:bg-cyan-950/50 focus:bg-cyan-900/30">
            Dark (Default)
          </SelectItem>
          <SelectItem value="light" className="text-cyan-100 hover:bg-cyan-950/50 focus:bg-cyan-900/30">
            Light
          </SelectItem>
          <SelectItem value="hc-black" className="text-cyan-100 hover:bg-cyan-950/50 focus:bg-cyan-900/30">
            High Contrast
          </SelectItem>
          <SelectItem value="cyberpunk" className="text-cyan-100 hover:bg-cyan-950/50 focus:bg-cyan-900/30">
            Cyberpunk
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
