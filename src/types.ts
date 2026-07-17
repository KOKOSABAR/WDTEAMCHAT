export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  lastSeen: string;
  statusMessage?: string;
  role?: 'CS LINE' | 'CS LC' | 'KAPTEN KASIR' | 'KASIR';
  password?: string;
}

export interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  avatar: string;
  description?: string;
  createdBy: string;
  admins: string[];
  members: string[]; // User IDs
  archivedBy: string[]; // User IDs who archived this chat
  mutedBy: string[]; // User IDs who muted this chat
  pinnedBy?: string[]; // User IDs who pinned this chat
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  type: 'text' | 'sticker' | 'image' | 'file' | 'voice';
  mediaUrl?: string; // For images, files, or voice notes
  fileName?: string; // For files
  fileSize?: string; // For files
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
    type: string;
  };
  readBy: string[]; // Array of User IDs who have read this message
  deletedFor: string[]; // Array of User IDs who deleted this message for themselves
  deletedForEveryone: boolean;
  reactions?: { [userId: string]: string }; // userId -> emoji
  createdAt: string;
}

export interface TypingStatus {
  chatId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface Sticker {
  id: string;
  emoji: string;
  name: string;
  category: string;
}

export const STICKER_PACKS: Sticker[] = [
  // LINE-like cute stickers represented by big expressive emojis or stylized badges
  { id: 'st1', emoji: '🐻', name: 'Brown Happy', category: 'Cute Bear' },
  { id: 'st2', emoji: '🐻❤️', name: 'Brown Love', category: 'Cute Bear' },
  { id: 'st3', emoji: '🐻😭', name: 'Brown Sad', category: 'Cute Bear' },
  { id: 'st4', emoji: '🐰', name: 'Cony Wave', category: 'Cute Bunny' },
  { id: 'st5', emoji: '🐰😡', name: 'Cony Angry', category: 'Cute Bunny' },
  { id: 'st6', emoji: '🐰🎉', name: 'Cony Party', category: 'Cute Bunny' },
  { id: 'st7', emoji: '🐸', name: 'Leonard Smile', category: 'Cute Frog' },
  { id: 'st8', emoji: '🐸💤', name: 'Leonard Sleep', category: 'Cute Frog' },
  { id: 'st9', emoji: '🐥', name: 'Sally Peek', category: 'Cute Chick' },
  { id: 'st10', emoji: '🐥💡', name: 'Sally Idea', category: 'Cute Chick' },
  { id: 'st11', emoji: '🤩', name: 'Star Eyes', category: 'Expressive' },
  { id: 'st12', emoji: '😎', name: 'Cool Guy', category: 'Expressive' },
  { id: 'st13', emoji: '😱', name: 'Omg', category: 'Expressive' },
  { id: 'st14', emoji: '🥳', name: 'Celebration', category: 'Expressive' },
  { id: 'st15', emoji: '👍', name: 'Good Job', category: 'Expressive' },
];

export const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', // Female 1
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', // Male 1
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', // Female 2
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', // Male 2
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80', // Female 3
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', // Male 3
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', // Female 4
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80', // Male 4
];

export const PRESET_GROUP_COVERS = [
  'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150&auto=format&fit=crop&q=80', // Team/Group 1
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80', // Team/Group 2
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=150&auto=format&fit=crop&q=80', // Team/Group 3
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=150&auto=format&fit=crop&q=80', // Team/Group 4
];
