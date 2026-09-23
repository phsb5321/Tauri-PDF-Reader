/**
 * Lectrice icon set - general + branded pairs.
 *
 * Two layers by design (brand-spec: "the bird goes where the meaning is"):
 *   - general: neutral functional chrome - no character. Gear/search/close/zoom and
 *     anything that is pure utility.
 *   - branded: the function carried by the nightingale. Voice, reading, rest and
 *     direction only - never chrome.
 *
 * Every icon shares the 24px box. The branded marks reuse the logo's own traced
 * geometry, so they stay on-brand by construction rather than by convention.
 */
export interface IconProps {
  /** Square size in px. 24 is the grid; the app renders 16-20 most often. */
  size?: number;
  className?: string;
}

export function IconPlay({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 5.4l10 6.6-10 6.6z" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="7.6" y="5.6" width="3.2" height="12.8" rx=".8" />
        <rect x="13.2" y="5.6" width="3.2" height="12.8" rx=".8" />
      </g>
    </svg>
  );
}

export function IconLibrary({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="4.6" y="14.2" width="9.4" height="2.1" rx=".6" />
        <rect x="4.6" y="16.9" width="9.4" height="2.1" rx=".6" />
        <rect x="4.6" y="19.6" width="9.4" height="2.1" rx=".6" />
      </g>
    </svg>
  );
}

export function IconBookmark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 4.4h10v15.2l-5-3.6-5 3.6z" fill="currentColor" />
    </svg>
  );
}

export function IconNight({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M15.2 4.2a7.6 7.6 0 1 0 3.4 13.9 8.8 8.8 0 0 1-3.4-13.9z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconNarrate({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M4.6 9.4h3l4-3.4v12l-4-3.4h-3z" />
        <path
          d="M14.4 9.2a4 4 0 0 1 0 5.6M16.8 7a7 7 0 0 1 0 10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </g>
    </svg>
  );
}

export function IconBack({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.4 5.2 3.6 12l7.8 6.8v-4.4h9v-4.8h-9z" fill="currentColor" />
    </svg>
  );
}

export function IconSing({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(12.0 11.0) scale(0.02503) translate(-384.50 -431.50)">
        <metadata>
          Created by potrace 1.16, written by Peter Selinger 2001-2019
        </metadata>
        <g
          transform="translate(0.000000,863.000000) scale(0.100000,-0.100000)"
          fill="currentColor"
          stroke="none"
        >
          <path
            d="M6975 8166 c-90 -31 -234 -92 -518 -218 -228 -102 -228 -102 -320
-84 -378 74 -713 -24 -985 -288 -187 -181 -279 -376 -337 -718 -66 -383 -209
-633 -485 -847 -383 -296 -710 -627 -935 -946 -135 -191 -312 -475 -527 -845
-367 -630 -616 -1065 -613 -1068 2 -2 112 77 246 176 134 99 245 178 247 177
2 -2 -55 -74 -126 -162 -419 -514 -662 -863 -1082 -1548 -129 -209 -274 -441
-323 -515 -262 -392 -469 -625 -707 -790 -75 -52 -75 -52 -20 -46 268 32 634
206 895 426 223 188 404 401 693 818 390 562 520 731 722 932 372 371 1000
760 1226 760 72 0 76 -4 52 -58 -26 -61 -34 -139 -19 -185 7 -20 81 -169 165
-331 84 -163 161 -321 171 -351 18 -51 18 -56 2 -90 -17 -35 -17 -35 -848 -37
-831 -3 -831 -3 -850 -27 -26 -31 -24 -57 6 -86 24 -25 24 -25 1018 -25 994 0
994 0 1028 -23 18 -12 46 -47 62 -77 15 -30 32 -56 36 -58 12 -4 21 36 21 101
0 57 0 57 185 57 144 0 192 -3 214 -15 41 -21 98 -90 114 -139 16 -49 28 -50
44 -4 35 99 -19 226 -122 287 -18 11 -18 11 5 5 60 -15 160 -93 160 -125 0 -5
284 -9 713 -9 790 0 757 -3 757 63 -1 80 29 77 -754 77 -695 0 -695 0 -715 28
-11 15 -43 41 -73 57 -47 26 -67 30 -180 37 -208 12 -202 7 -628 486 -165 186
-179 208 -180 277 0 113 42 144 390 286 325 132 746 361 963 523 415 309 674
703 781 1186 75 341 52 604 -79 912 -131 306 -154 414 -121 573 29 142 131
319 252 437 43 41 84 62 339 174 160 69 295 130 300 136 6 6 -8 7 -40 3 -27
-3 -156 -17 -285 -30 -129 -14 -307 -34 -394 -45 -213 -27 -210 -27 -202 8 22
87 67 155 188 279 157 161 402 389 498 466 41 33 77 61 79 63 12 11 -43 0
-104 -20z m-1047 -591 c61 -51 66 -129 12 -183 -51 -52 -135 -49 -183 6 -25
27 -33 94 -17 133 28 68 131 92 188 44z m-1332 -4845 c125 -131 235 -251 245
-267 25 -37 24 -74 -2 -107 -28 -36 -69 -34 -163 9 -117 55 -139 79 -218 245
-100 208 -188 408 -188 426 0 27 88 -55 326 -306z"
          />
        </g>
      </g>
      <path
        d="M14.2 7.4c1.6-.9 3.2-1.2 4.8-.9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.1"
        stroke-linecap="round"
      />
    </svg>
  );
}

export function IconLibraryBird({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="4.6" y="14.2" width="9.4" height="2.1" rx=".6" />
        <rect x="4.6" y="16.9" width="9.4" height="2.1" rx=".6" />
        <rect x="4.6" y="19.6" width="9.4" height="2.1" rx=".6" />
      </g>
      <g transform="translate(12.0 7.4) scale(0.01724) translate(-384.50 -431.50)">
        <metadata>
          Created by potrace 1.16, written by Peter Selinger 2001-2019
        </metadata>
        <g
          transform="translate(0.000000,863.000000) scale(0.100000,-0.100000)"
          fill="currentColor"
          stroke="none"
        >
          <path
            d="M6975 8166 c-90 -31 -234 -92 -518 -218 -228 -102 -228 -102 -320
-84 -378 74 -713 -24 -985 -288 -187 -181 -279 -376 -337 -718 -66 -383 -209
-633 -485 -847 -383 -296 -710 -627 -935 -946 -135 -191 -312 -475 -527 -845
-367 -630 -616 -1065 -613 -1068 2 -2 112 77 246 176 134 99 245 178 247 177
2 -2 -55 -74 -126 -162 -419 -514 -662 -863 -1082 -1548 -129 -209 -274 -441
-323 -515 -262 -392 -469 -625 -707 -790 -75 -52 -75 -52 -20 -46 268 32 634
206 895 426 223 188 404 401 693 818 390 562 520 731 722 932 372 371 1000
760 1226 760 72 0 76 -4 52 -58 -26 -61 -34 -139 -19 -185 7 -20 81 -169 165
-331 84 -163 161 -321 171 -351 18 -51 18 -56 2 -90 -17 -35 -17 -35 -848 -37
-831 -3 -831 -3 -850 -27 -26 -31 -24 -57 6 -86 24 -25 24 -25 1018 -25 994 0
994 0 1028 -23 18 -12 46 -47 62 -77 15 -30 32 -56 36 -58 12 -4 21 36 21 101
0 57 0 57 185 57 144 0 192 -3 214 -15 41 -21 98 -90 114 -139 16 -49 28 -50
44 -4 35 99 -19 226 -122 287 -18 11 -18 11 5 5 60 -15 160 -93 160 -125 0 -5
284 -9 713 -9 790 0 757 -3 757 63 -1 80 29 77 -754 77 -695 0 -695 0 -715 28
-11 15 -43 41 -73 57 -47 26 -67 30 -180 37 -208 12 -202 7 -628 486 -165 186
-179 208 -180 277 0 113 42 144 390 286 325 132 746 361 963 523 415 309 674
703 781 1186 75 341 52 604 -79 912 -131 306 -154 414 -121 573 29 142 131
319 252 437 43 41 84 62 339 174 160 69 295 130 300 136 6 6 -8 7 -40 3 -27
-3 -156 -17 -285 -30 -129 -14 -307 -34 -394 -45 -213 -27 -210 -27 -202 8 22
87 67 155 188 279 157 161 402 389 498 466 41 33 77 61 79 63 12 11 -43 0
-104 -20z m-1047 -591 c61 -51 66 -129 12 -183 -51 -52 -135 -49 -183 6 -25
27 -33 94 -17 133 28 68 131 92 188 44z m-1332 -4845 c125 -131 235 -251 245
-267 25 -37 24 -74 -2 -107 -28 -36 -69 -34 -163 9 -117 55 -139 79 -218 245
-100 208 -188 408 -188 426 0 27 88 -55 326 -306z"
          />
        </g>
      </g>
    </svg>
  );
}

export function IconBookmarkFeather({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(12.0 12.0) scale(0.06857) translate(-123.00 -164.50)">
        <g>
          <g
            transform="translate(0.000000,329.000000) scale(0.100000,-0.100000)"
            fill="currentColor"
            stroke="none"
          >
            <path
              d="M1982 2539 c-140 -17 -307 -92 -522 -234 -199 -132 -302 -243 -393
-424 -40 -81 -47 -90 -42 -56 8 48 31 142 41 169 23 59 -171 -130 -259 -251
-120 -168 -176 -320 -180 -494 -1 -53 -5 -95 -8 -93 -4 2 -17 30 -29 61 -33
82 -40 85 -40 17 0 -77 13 -151 52 -292 31 -113 31 -113 -20 -282 -29 -93 -52
-178 -52 -189 0 -20 35 -69 43 -61 3 3 37 79 77 170 40 91 77 170 84 176 6 6
74 27 151 47 77 19 167 48 200 64 60 28 60 28 -25 33 l-85 5 95 34 c231 82
374 175 454 295 41 61 36 66 -40 45 -36 -10 -93 -21 -127 -24 l-62 -6 63 25
c209 83 334 183 402 318 22 44 40 89 40 99 0 17 -4 16 -55 -6 -30 -14 -74 -27
-98 -31 -42 -5 -42 -5 26 32 138 75 236 200 292 369 28 85 98 476 87 486 -4 3
-35 2 -70 -2z m-518 -602 c-244 -261 -400 -484 -644 -923 -67 -120 -126 -223
-131 -228 -48 -50 25 151 131 360 144 283 319 511 570 740 69 63 127 114 129
114 2 0 -23 -28 -55 -63z"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function IconNightBird({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M15.2 4.2a7.6 7.6 0 1 0 3.4 13.9 8.8 8.8 0 0 1-3.4-13.9z"
        fill="currentColor"
      />
      <g transform="translate(12.0 15.4) scale(0.01390) translate(-384.50 -431.50)">
        <metadata>
          Created by potrace 1.16, written by Peter Selinger 2001-2019
        </metadata>
        <g
          transform="translate(0.000000,863.000000) scale(0.100000,-0.100000)"
          fill="currentColor"
          stroke="none"
        >
          <path
            d="M6975 8166 c-90 -31 -234 -92 -518 -218 -228 -102 -228 -102 -320
-84 -378 74 -713 -24 -985 -288 -187 -181 -279 -376 -337 -718 -66 -383 -209
-633 -485 -847 -383 -296 -710 -627 -935 -946 -135 -191 -312 -475 -527 -845
-367 -630 -616 -1065 -613 -1068 2 -2 112 77 246 176 134 99 245 178 247 177
2 -2 -55 -74 -126 -162 -419 -514 -662 -863 -1082 -1548 -129 -209 -274 -441
-323 -515 -262 -392 -469 -625 -707 -790 -75 -52 -75 -52 -20 -46 268 32 634
206 895 426 223 188 404 401 693 818 390 562 520 731 722 932 372 371 1000
760 1226 760 72 0 76 -4 52 -58 -26 -61 -34 -139 -19 -185 7 -20 81 -169 165
-331 84 -163 161 -321 171 -351 18 -51 18 -56 2 -90 -17 -35 -17 -35 -848 -37
-831 -3 -831 -3 -850 -27 -26 -31 -24 -57 6 -86 24 -25 24 -25 1018 -25 994 0
994 0 1028 -23 18 -12 46 -47 62 -77 15 -30 32 -56 36 -58 12 -4 21 36 21 101
0 57 0 57 185 57 144 0 192 -3 214 -15 41 -21 98 -90 114 -139 16 -49 28 -50
44 -4 35 99 -19 226 -122 287 -18 11 -18 11 5 5 60 -15 160 -93 160 -125 0 -5
284 -9 713 -9 790 0 757 -3 757 63 -1 80 29 77 -754 77 -695 0 -695 0 -715 28
-11 15 -43 41 -73 57 -47 26 -67 30 -180 37 -208 12 -202 7 -628 486 -165 186
-179 208 -180 277 0 113 42 144 390 286 325 132 746 361 963 523 415 309 674
703 781 1186 75 341 52 604 -79 912 -131 306 -154 414 -121 573 29 142 131
319 252 437 43 41 84 62 339 174 160 69 295 130 300 136 6 6 -8 7 -40 3 -27
-3 -156 -17 -285 -30 -129 -14 -307 -34 -394 -45 -213 -27 -210 -27 -202 8 22
87 67 155 188 279 157 161 402 389 498 466 41 33 77 61 79 63 12 11 -43 0
-104 -20z m-1047 -591 c61 -51 66 -129 12 -183 -51 -52 -135 -49 -183 6 -25
27 -33 94 -17 133 28 68 131 92 188 44z m-1332 -4845 c125 -131 235 -251 245
-267 25 -37 24 -74 -2 -107 -28 -36 -69 -34 -163 9 -117 55 -139 79 -218 245
-100 208 -188 408 -188 426 0 27 88 -55 326 -306z"
          />
        </g>
      </g>
    </svg>
  );
}

export function IconNarrateBird({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(12.0 13.4) scale(0.02336) translate(-384.50 -431.50)">
        <metadata>
          Created by potrace 1.16, written by Peter Selinger 2001-2019
        </metadata>
        <g
          transform="translate(0.000000,863.000000) scale(0.100000,-0.100000)"
          fill="currentColor"
          stroke="none"
        >
          <path
            d="M6975 8166 c-90 -31 -234 -92 -518 -218 -228 -102 -228 -102 -320
-84 -378 74 -713 -24 -985 -288 -187 -181 -279 -376 -337 -718 -66 -383 -209
-633 -485 -847 -383 -296 -710 -627 -935 -946 -135 -191 -312 -475 -527 -845
-367 -630 -616 -1065 -613 -1068 2 -2 112 77 246 176 134 99 245 178 247 177
2 -2 -55 -74 -126 -162 -419 -514 -662 -863 -1082 -1548 -129 -209 -274 -441
-323 -515 -262 -392 -469 -625 -707 -790 -75 -52 -75 -52 -20 -46 268 32 634
206 895 426 223 188 404 401 693 818 390 562 520 731 722 932 372 371 1000
760 1226 760 72 0 76 -4 52 -58 -26 -61 -34 -139 -19 -185 7 -20 81 -169 165
-331 84 -163 161 -321 171 -351 18 -51 18 -56 2 -90 -17 -35 -17 -35 -848 -37
-831 -3 -831 -3 -850 -27 -26 -31 -24 -57 6 -86 24 -25 24 -25 1018 -25 994 0
994 0 1028 -23 18 -12 46 -47 62 -77 15 -30 32 -56 36 -58 12 -4 21 36 21 101
0 57 0 57 185 57 144 0 192 -3 214 -15 41 -21 98 -90 114 -139 16 -49 28 -50
44 -4 35 99 -19 226 -122 287 -18 11 -18 11 5 5 60 -15 160 -93 160 -125 0 -5
284 -9 713 -9 790 0 757 -3 757 63 -1 80 29 77 -754 77 -695 0 -695 0 -715 28
-11 15 -43 41 -73 57 -47 26 -67 30 -180 37 -208 12 -202 7 -628 486 -165 186
-179 208 -180 277 0 113 42 144 390 286 325 132 746 361 963 523 415 309 674
703 781 1186 75 341 52 604 -79 912 -131 306 -154 414 -121 573 29 142 131
319 252 437 43 41 84 62 339 174 160 69 295 130 300 136 6 6 -8 7 -40 3 -27
-3 -156 -17 -285 -30 -129 -14 -307 -34 -394 -45 -213 -27 -210 -27 -202 8 22
87 67 155 188 279 157 161 402 389 498 466 41 33 77 61 79 63 12 11 -43 0
-104 -20z m-1047 -591 c61 -51 66 -129 12 -183 -51 -52 -135 -49 -183 6 -25
27 -33 94 -17 133 28 68 131 92 188 44z m-1332 -4845 c125 -131 235 -251 245
-267 25 -37 24 -74 -2 -107 -28 -36 -69 -34 -163 9 -117 55 -139 79 -218 245
-100 208 -188 408 -188 426 0 27 88 -55 326 -306z"
          />
        </g>
      </g>
      <path
        d="M18.4 8.2a3.4 3.4 0 0 1 0 5M20.6 6.4a6 6 0 0 1 0 8.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  );
}

export function IconForwardBird({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(12.0 12.0) scale(0.06345) translate(-174.00 -129.50)">
        <g>
          <g
            transform="translate(0.000000,259.000000) scale(0.100000,-0.100000)"
            fill="currentColor"
            stroke="none"
          >
            <path
              d="M1519 1973 c-227 -230 -249 -260 -318 -433 -40 -100 -79 -131 -166
-129 -126 3 -124 -9 -39 178 41 90 72 166 69 169 -2 3 -154 -94 -337 -216
-331 -221 -331 -221 -282 -251 293 -182 600 -368 602 -366 2 2 -26 51 -62 108
-36 58 -66 108 -66 111 0 3 18 -1 41 -9 88 -31 167 -83 259 -170 124 -118 210
-173 405 -263 266 -122 376 -178 460 -236 44 -30 81 -51 83 -46 6 17 -42 95
-92 148 -44 47 -47 53 -21 40 17 -9 40 -19 53 -23 23 -7 23 -7 3 32 -18 36
-82 102 -127 130 -16 11 -15 11 9 3 16 -6 33 -10 39 -10 12 0 -14 44 -50 83
-26 27 -26 27 74 28 54 0 108 4 118 8 14 5 62 -16 180 -82 343 -189 466 -239
616 -245 109 -4 122 4 45 28 -22 7 -62 24 -90 38 -49 24 -225 139 -225 146 0
2 17 0 38 -5 20 -5 63 -9 96 -9 59 0 59 0 -65 61 -68 34 -234 114 -369 179
-162 77 -287 145 -370 199 -135 90 -230 141 -298 162 -43 13 -43 13 -7 30 72
35 165 127 165 162 0 9 -33 6 -110 -9 -14 -3 3 9 36 26 34 17 82 48 107 70 44
39 104 126 93 137 -2 3 -33 -4 -67 -16 -89 -30 -93 -26 -19 19 100 62 143 102
179 170 18 34 31 64 28 67 -3 3 -47 -13 -98 -36 -51 -22 -94 -39 -96 -38 -1 2
27 23 64 47 104 69 203 175 203 218 0 14 -80 17 -95 4 -6 -5 -32 -21 -60 -36
-50 -27 -50 -27 -10 8 40 36 40 36 -136 36 l-175 0 -215 -217z"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Function -> { general, branded }, so a caller can pick by context. */
export const iconPairs = {
  play: { general: IconPlay, branded: IconSing },
  library: { general: IconLibrary, branded: IconLibraryBird },
  bookmark: { general: IconBookmark, branded: IconBookmarkFeather },
  night: { general: IconNight, branded: IconNightBird },
  narrate: { general: IconNarrate, branded: IconNarrateBird },
  next: { general: IconBack, branded: IconForwardBird },
} as const;
