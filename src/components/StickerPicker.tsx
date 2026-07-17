import React, { useState } from "react";
import { STICKER_PACKS, Sticker } from "../types.ts";
import { Smile, Sticker as StickerIcon } from "lucide-react";
import { motion } from "motion/react";

interface StickerPickerProps {
  onSelectSticker: (sticker: Sticker) => void;
  onSelectEmoji: (emoji: string) => void;
}

const POPULAR_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", 
  "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", 
  "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", 
  "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😴", "🥱", "👽", "🤖", "💩", "🔥",
  "❤️", "💖", "✨", "🎉", "👍", "👎", "👏", "🙌", "🙏", "💪", "🧠", "💼", "🚗", "🍕", "🍔", "☕"
];

export default function StickerPicker({ onSelectSticker, onSelectEmoji }: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<'stickers' | 'emojis'>('stickers');

  return (
    <div className="bg-slate-900/90 border border-white/10 glass rounded-2xl shadow-2xl p-4 w-72 max-w-sm flex flex-col h-72 text-white">
      {/* Tabs */}
      <div className="flex bg-white/5 p-1 rounded-xl gap-1 shrink-0 mb-3 border border-white/5">
        <button
          type="button"
          onClick={() => setActiveTab('stickers')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${activeTab === 'stickers' ? 'bg-white/10 shadow-sm text-indigo-400' : 'text-white/60 hover:text-white'}`}
        >
          <StickerIcon className="w-3.5 h-3.5 text-indigo-400" /> Stiker LINE
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('emojis')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${activeTab === 'emojis' ? 'bg-white/10 shadow-sm text-indigo-400' : 'text-white/60 hover:text-white'}`}
        >
          <Smile className="w-3.5 h-3.5 text-indigo-400" /> Emoji
        </button>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === 'stickers' ? (
          /* Stickers Tab Grid */
          <div className="grid grid-cols-4 gap-2.5 p-1">
            {STICKER_PACKS.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => onSelectSticker(sticker)}
                title={sticker.name}
                className="group relative h-12 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-3xl cursor-pointer shadow-sm border border-white/5"
              >
                {sticker.emoji}
                {/* Popover tooltip naming sticker */}
                <span className="absolute bottom-full mb-1 bg-slate-800 text-white text-[8px] font-medium px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-30 shadow">
                  {sticker.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          /* Emojis Tab Grid */
          <div className="grid grid-cols-6 gap-2 p-1">
            {POPULAR_EMOJIS.map((emoji, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectEmoji(emoji)}
                className="h-9 w-9 rounded-lg hover:bg-white/10 active:bg-indigo-500/20 hover:scale-110 text-xl flex items-center justify-center transition-all cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info indicator footer */}
      <div className="pt-2 text-[10px] text-white/50 font-semibold text-center border-t border-white/5 shrink-0 mt-2">
        {activeTab === 'stickers' ? "Klik stiker untuk langsung mengirim" : "Klik emoji untuk menyisipkan ke pesan"}
      </div>
    </div>
  );
}
