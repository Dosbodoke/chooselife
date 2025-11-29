import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@chooselife/database';

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

  const bgUrl = supabase.storage.from('promo').getPublicUrl('highline-walk.webp').data.publicUrl;

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
          backgroundColor: '#fff',
          position: 'relative',
        }}
      >
        <img
          src={bgUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
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
