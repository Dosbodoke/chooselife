import { Database } from '@chooselife/database';
import { createClient } from '@supabase/supabase-js';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'News Detail';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from('news')
    .select('content')
    .eq('id', id)
    .single();

  const content = data?.content || '';
  const match = content.match(/^#\s+(.+)$/m);
  const title = match ? match[1] : 'News Update';

  const { data: { publicUrl } } = supabase.storage.from('promo').getPublicUrl('highline-walk.webp');

  // Fetch the image and convert to ArrayBuffer to ensure it renders correctly in Satori/NextOG
  const bgImageBuffer = await fetch(publicUrl)
    .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch image');
        return res.arrayBuffer();
    })
    .catch((e) => {
        console.error('Error loading OG background:', e);
        return null;
    });

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          backgroundColor: '#1a1a1a', // Fallback background color
          position: 'relative',
        }}
      >
        {bgImageBuffer && (
            // @ts-ignore - next/og supports ArrayBuffer for src
            <img
            src={bgImageBuffer}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
            }}
            />
        )}
        
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 80%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '60px',
            zIndex: 10,
            width: '100%',
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: 64,
              fontWeight: 'bold',
              lineHeight: 1.1,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
