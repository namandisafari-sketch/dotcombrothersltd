-- Create a scheduled job to trigger the admin report every 30 minutes
-- The function itsel checks if it's the correct time and if it should be sent
SELECT cron.schedule(
  'send-admin-report-scheduler',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ojofufyjehayzozefqca.supabase.co/functions/v1/send-admin-report',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"scheduledMode": true}'::jsonb
    ) as request_id;
  $$
);
