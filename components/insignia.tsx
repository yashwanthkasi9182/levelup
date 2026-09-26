import type { Mark } from '@/lib/model';
export const marks: Mark[] = ['apex', 'orbit', 'prism', 'crest', 'pulse', 'eclipse'];
export function Insignia({ mark = 'apex', size = 32 }: { mark?: Mark; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${mark} insignia`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {mark === 'apex' && (
        <>
          <path d="M8 35 24 9l16 26H8Z" />
          <path d="m17 35 7-12 7 12M24 9v6" />
          <path d="M20 39h8" />
        </>
      )}
      {mark === 'orbit' && (
        <>
          <circle cx="24" cy="24" r="5" />
          <ellipse cx="24" cy="24" rx="19" ry="9" transform="rotate(-40 24 24)" />
          <path d="M12 12a17 17 0 0 1 24 24" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </>
      )}
      {mark === 'prism' && (
        <>
          <path d="m24 5 17 19-17 19L7 24 24 5Z" />
          <path d="m24 5 7 19-7 19-7-19 7-19ZM7 24h34" />
        </>
      )}
      {mark === 'crest' && (
        <>
          <path d="m24 6 15 6v13c0 9-15 17-15 17S9 34 9 25V12l15-6Z" />
          <path d="m16 26 8-12 8 12M18 31h12M24 14v21" />
        </>
      )}
      {mark === 'pulse' && (
        <>
          <path d="M7 13v-3h10M31 10h10v10M41 31v7H30M18 38H7v-9" />
          <path d="M6 25h10l5-12 6 22 5-10h10" />
        </>
      )}
      {mark === 'eclipse' && (
        <>
          <path d="M28 7a17 17 0 1 0 13 22A16 16 0 0 1 28 7Z" />
          <path d="M34 8v10M29 13h10M22 35l2 2" />
        </>
      )}
    </svg>
  );
}
