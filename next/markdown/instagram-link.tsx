import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-label="Instagram"
    role="img"
    style={{
      color: "#E1306C",
    }}
  >
    <title>Ícone do Instagram</title>
    <rect x="2" y="2" width="20" height="20" rx="5.656" ry="5.656"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

export const InstagramLink: React.FC<{
  name: string;
  URL: string;
}> = ({ name, URL }) => {
  return (
    <Link href={URL} target="_blank">
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4">
              <InstagramIcon />
            </div>
            <div className="text-sm font-medium">{name}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
