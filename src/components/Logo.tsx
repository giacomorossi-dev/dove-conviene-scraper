import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

const Logo = ({ className }: Props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 280 60"
    role="img"
    aria-label="Scaper Conviene"
    className={cn("h-8 w-auto", className)}
    fill="none"
  >
    <g stroke="#0f172a" strokeWidth="2.5">
      <circle cx="30" cy="30" r="24" />
      <circle cx="30" cy="30" r="16" />
    </g>
    <text
      x="30"
      y="30"
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
      fontWeight="900"
      fontSize="32"
      fill="#dc2626"
    >
      S
    </text>
    <text
      x="65"
      y="30"
      dominantBaseline="central"
      fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
      fontSize="22"
      fill="#0f172a"
    >
      <tspan fontWeight="800">Scaper</tspan>
      <tspan fontWeight="400" fill="#64748b" dx="6">
        Conviene
      </tspan>
    </text>
  </svg>
);

export default Logo;
