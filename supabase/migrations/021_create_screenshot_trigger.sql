-- Create database webhook to trigger Edge Function on new screenshot uploads
create or replace function public.trigger_screenshot_analysis()
returns trigger as $$
begin
  -- Only trigger for new files in screenshots folder
  if new.name like 'screenshots/%' and new.name like '%.png' then
    perform
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/analyze-screenshot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('record', row_to_json(new))
      );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger on storage.objects table
create trigger on_screenshot_upload
  after insert on storage.objects
  for each row
  when (new.bucket_id = 'marketing-assets')
  execute function public.trigger_screenshot_analysis();
