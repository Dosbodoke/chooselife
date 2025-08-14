import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const YouTubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ color: "#FF0000" }}
    {...props}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const YoutubeLink: React.FC<{
  name: string;
  URL: string;
}> = ({ name, URL }) => {
  return (
    <Link href={URL} target="_blank">
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4">
              <YouTubeIcon />
            </div>
            <div className="text-sm font-medium">{name}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
