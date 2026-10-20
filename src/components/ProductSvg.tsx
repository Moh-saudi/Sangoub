import React from 'react';

interface ProductSvgProps {
  type: string;
  className?: string;
}

export const ProductSvg: React.FC<ProductSvgProps> = ({ type, className = 'w-full h-full' }) => {
  switch (type) {
    case 'foul':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-foul)" />
          {/* Wooden board */}
          <ellipse cx="100" cy="115" rx="75" ry="24" fill="#E2E8F0" />
          <ellipse cx="100" cy="112" rx="70" ry="22" fill="#CBD5E1" opacity="0.6" />
          {/* Egyptian Pita bread */}
          <path d="M45 95 C45 65 155 65 155 95 C155 115 45 115 45 95 Z" fill="#E9B774" stroke="#D0964D" strokeWidth="3" />
          <path d="M50 92 C55 70 145 70 150 92 Z" fill="#F4CB91" />
          {/* Foul filling */}
          <path d="M55 90 C65 82 135 82 145 90 C140 102 60 102 55 90 Z" fill="#78350F" />
          {/* Tahini drizzle */}
          <path d="M60 88 Q75 96 90 87 T120 94 T140 88" stroke="#FEF3C7" strokeWidth="4" strokeLinecap="round" />
          {/* Olive oil sheen */}
          <ellipse cx="85" cy="88" rx="8" ry="4" fill="#F59E0B" opacity="0.7" />
          <ellipse cx="115" cy="89" rx="10" ry="4" fill="#F59E0B" opacity="0.7" />
          {/* Parsley flakes */}
          <circle cx="75" cy="87" r="2.5" fill="#15803D" />
          <circle cx="98" cy="91" r="2.5" fill="#16A34A" />
          <circle cx="125" cy="86" r="2.5" fill="#15803D" />
          {/* Tomato slice */}
          <circle cx="132" cy="78" r="9" fill="#DC2626" />
          <circle cx="132" cy="78" r="6" fill="#EF4444" />
          <circle cx="132" cy="78" r="2" fill="#FEE2E2" />
          {/* Steaming lines */}
          <path d="M85 55 Q80 45 88 35" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          <path d="M102 50 Q108 40 100 30" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          <defs>
            <linearGradient id="bg-foul" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ECFDF5" />
              <stop offset="1" stopColor="#D1FAE5" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'falafel':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-falafel)" />
          {/* Plate */}
          <ellipse cx="100" cy="115" rx="72" ry="22" fill="#E2E8F0" />
          {/* Falafel patties */}
          <g>
            {/* Patty 1 */}
            <circle cx="70" cy="95" r="24" fill="#92400E" stroke="#78350F" strokeWidth="2" />
            <circle cx="68" cy="93" r="20" fill="#B45309" />
            <circle cx="62" cy="88" r="1.5" fill="#FEF3C7" />
            <circle cx="75" cy="90" r="1.5" fill="#FEF3C7" />
            <circle cx="70" cy="99" r="1.5" fill="#FEF3C7" />
            <circle cx="65" cy="98" r="2" fill="#15803D" />
            {/* Patty 2 */}
            <circle cx="125" cy="96" r="24" fill="#92400E" stroke="#78350F" strokeWidth="2" />
            <circle cx="123" cy="94" r="20" fill="#B45309" />
            <circle cx="118" cy="89" r="1.5" fill="#FEF3C7" />
            <circle cx="130" cy="92" r="1.5" fill="#FEF3C7" />
            <circle cx="125" cy="100" r="1.5" fill="#FEF3C7" />
            <circle cx="121" cy="97" r="2" fill="#15803D" />
            {/* Center Patty (Stacked) */}
            <circle cx="98" cy="80" r="25" fill="#78350F" stroke="#451A03" strokeWidth="2" />
            <circle cx="96" cy="78" r="21" fill="#92400E" />
            {/* Sesame seeds */}
            <ellipse cx="90" cy="72" rx="2" ry="1" fill="#FEF08A" transform="rotate(25 90 72)" />
            <ellipse cx="104" cy="74" rx="2" ry="1" fill="#FEF08A" transform="rotate(-30 104 74)" />
            <ellipse cx="95" cy="84" rx="2" ry="1" fill="#FEF08A" transform="rotate(10 95 84)" />
            <ellipse cx="85" cy="82" rx="2" ry="1" fill="#FEF08A" transform="rotate(-15 85 82)" />
            <ellipse cx="108" cy="83" rx="2" ry="1" fill="#FEF08A" transform="rotate(45 108 83)" />
            <circle cx="96" cy="76" r="2" fill="#16A34A" />
          </g>
          {/* Tahini cup */}
          <path d="M142 100 L158 100 L154 116 L146 116 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
          <ellipse cx="150" cy="100" rx="8" ry="3" fill="#FEF3C7" />
          <defs>
            <linearGradient id="bg-falafel" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FEF3C7" />
              <stop offset="1" stopColor="#FDE68A" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'water':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-water)" />
          {/* Shadow */}
          <ellipse cx="100" cy="130" rx="28" ry="7" fill="#94A3B8" opacity="0.3" />
          {/* Bottle body */}
          <rect x="84" y="45" width="32" height="75" rx="6" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2.5" />
          {/* Water reflection */}
          <path d="M88 50 L92 50 L92 115 L88 115 Z" fill="#BAE6FD" opacity="0.7" />
          {/* Bottle Neck & Cap */}
          <rect x="91" y="28" width="18" height="18" rx="2" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2" />
          <rect x="89" y="22" width="22" height="9" rx="3" fill="#0284C7" />
          {/* Bottle Label */}
          <rect x="84" y="68" width="32" height="30" fill="#0284C7" />
          <path d="M88 78 Q100 70 112 78" stroke="#38BDF8" strokeWidth="2" />
          <circle cx="100" cy="88" r="4" fill="#38BDF8" />
          {/* Ice / droplets */}
          <circle cx="124" cy="62" r="3" fill="#38BDF8" opacity="0.8" />
          <circle cx="75" cy="80" r="2.5" fill="#38BDF8" opacity="0.8" />
          <circle cx="122" cy="100" r="2" fill="#38BDF8" opacity="0.8" />
          <defs>
            <linearGradient id="bg-water" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F0F9FF" />
              <stop offset="1" stopColor="#E0F2FE" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'coffee':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-coffee)" />
          {/* Saucer */}
          <ellipse cx="100" cy="116" rx="55" ry="16" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="2" />
          {/* Cup */}
          <path d="M68 65 L76 108 C77 114 85 118 100 118 C115 118 123 114 124 108 L132 65 Z" fill="#047857" />
          <ellipse cx="100" cy="65" rx="32" ry="14" fill="#065F46" />
          {/* Cup Handle */}
          <path d="M128 72 C142 72 144 94 125 96" stroke="#047857" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* Coffee surface */}
          <ellipse cx="100" cy="65" rx="28" ry="11" fill="#451A03" />
          {/* Latte Heart Art */}
          <path d="M100 68 C94 62 88 64 92 70 C96 74 100 77 100 77 C100 77 104 74 108 70 C112 64 106 62 100 68 Z" fill="#FEF3C7" />
          {/* Steam */}
          <path d="M92 48 Q86 38 94 28" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M106 44 Q112 34 104 24" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <defs>
            <linearGradient id="bg-coffee" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F0FDF4" />
              <stop offset="1" stopColor="#DCFCE7" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'chips':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-chips)" />
          {/* Chips Bag */}
          <g transform="rotate(-6 100 80)">
            <path d="M72 40 L128 40 L122 120 L78 120 Z" fill="#EA580C" stroke="#C2410C" strokeWidth="2.5" />
            {/* Bag shine */}
            <path d="M78 45 L86 45 L89 115 L83 115 Z" fill="#F97316" opacity="0.7" />
            {/* Zigzag edges */}
            <path d="M72 40 L75 36 L78 40 L81 36 L84 40 L87 36 L90 40 L93 36 L96 40 L99 36 L102 40 L105 36 L108 40 L111 36 L114 40 L117 36 L120 40 L123 36 L126 40 L128 40" stroke="#C2410C" strokeWidth="2" fill="none" />
            <path d="M78 120 L81 124 L84 120 L87 124 L90 120 L93 124 L96 120 L99 124 L102 120 L105 124 L108 120 L111 124 L114 120 L117 124 L120 120 L122 120" stroke="#C2410C" strokeWidth="2" fill="none" />
            {/* Logo area */}
            <circle cx="100" cy="75" r="16" fill="#FACC15" />
            <path d="M92 75 Q100 68 108 75" stroke="#B45309" strokeWidth="2" />
          </g>
          {/* Loose chips outside */}
          <ellipse cx="145" cy="110" rx="14" ry="8" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" transform="rotate(15 145 110)" />
          <ellipse cx="60" cy="115" rx="12" ry="7" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" transform="rotate(-20 60 115)" />
          <defs>
            <linearGradient id="bg-chips" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFF7ED" />
              <stop offset="1" stopColor="#FFEDD5" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'croissant':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-croissant)" />
          <ellipse cx="100" cy="118" rx="60" ry="16" fill="#E2E8F0" />
          {/* Crescent body */}
          <path d="M55 105 C50 80 80 65 100 65 C120 65 150 80 145 105 C135 108 120 90 100 90 C80 90 65 108 55 105 Z" fill="#D97706" stroke="#B45309" strokeWidth="2.5" />
          {/* Flaky layers */}
          <path d="M80 68 C88 64 112 64 120 68 C115 85 85 85 80 68 Z" fill="#F59E0B" />
          <path d="M68 85 C75 75 88 74 95 86" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
          <path d="M105 86 C112 74 125 75 132 85" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
          {/* Butter shine */}
          <ellipse cx="100" cy="74" rx="8" ry="4" fill="#FEF08A" opacity="0.6" />
          <defs>
            <linearGradient id="bg-croissant" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FEFCE8" />
              <stop offset="1" stopColor="#FEF08A" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'juice':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-juice)" />
          {/* Glass */}
          <path d="M78 45 L86 118 C87 124 93 126 100 126 C107 126 113 124 114 118 L122 45 Z" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
          {/* Orange Juice liquid */}
          <path d="M80 60 L87 116 C88 121 93 123 100 123 C107 123 112 121 113 116 L120 60 Z" fill="#EA580C" />
          <ellipse cx="100" cy="60" rx="20" ry="6" fill="#F97316" />
          {/* Straw */}
          <path d="M105 110 L122 30 L135 25" stroke="#10B981" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* Orange Slice on rim */}
          <circle cx="124" cy="45" r="14" fill="#F97316" stroke="#C2410C" strokeWidth="1.5" />
          <circle cx="124" cy="45" r="11" fill="#FDBA74" />
          <path d="M124 34 L124 56 M113 45 L135 45" stroke="#EA580C" strokeWidth="1.5" />
          <defs>
            <linearGradient id="bg-juice" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFF7ED" />
              <stop offset="1" stopColor="#FED7AA" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'hawawshi':
    default:
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" rx="16" fill="url(#bg-food-generic)" />
          <ellipse cx="100" cy="115" rx="65" ry="18" fill="#E2E8F0" />
          {/* Baladi bread disc */}
          <circle cx="100" cy="90" r="38" fill="#D97706" stroke="#92400E" strokeWidth="2.5" />
          <circle cx="100" cy="90" r="34" fill="#F59E0B" />
          {/* Grilled char marks */}
          <line x1="75" y1="80" x2="125" y2="80" stroke="#78350F" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <line x1="72" y1="92" x2="128" y2="92" stroke="#78350F" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <line x1="80" y1="104" x2="120" y2="104" stroke="#78350F" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          {/* Cut triangle */}
          <path d="M100 90 L132 108 L136 78 Z" fill="#78350F" />
          <defs>
            <linearGradient id="bg-food-generic" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F8FAFC" />
              <stop offset="1" stopColor="#E2E8F0" />
            </linearGradient>
          </defs>
        </svg>
      );
  }
};
