-- News table
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE
);
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public news are viewable by everyone." ON news FOR SELECT USING (true);


-- News reactions table
CREATE TABLE news_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  UNIQUE (news_id, user_id, reaction)
);
ALTER TABLE news_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see all reactions." ON news_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions." ON news_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reactions." ON news_reactions FOR DELETE USING (auth.uid() = user_id);


-- News comments table
CREATE TABLE news_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL
);
ALTER TABLE news_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see all comments." ON news_comments FOR SELECT USING (true);
CREATE POLICY "Users can add comments." ON news_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments." ON news_comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments." ON news_comments FOR DELETE USING (auth.uid() = user_id);
