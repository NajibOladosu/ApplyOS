-- Create junction table for many-to-many relationship between applications and documents
CREATE TABLE public.application_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(application_id, document_id)
);

-- Create index for faster lookups
CREATE INDEX idx_application_documents_application_id ON public.application_documents(application_id);
CREATE INDEX idx_application_documents_document_id ON public.application_documents(document_id);

-- Enable Row Level Security
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for application_documents table
CREATE POLICY "Users can view application documents for own applications"
  ON public.application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = application_documents.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert application documents for own applications"
  ON public.application_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = application_documents.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete application documents for own applications"
  ON public.application_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      WHERE applications.id = application_documents.application_id
      AND applications.user_id = auth.uid()
    )
  );
