# Podcast Transcripts

Automated transcript generation for podcast episodes with AI-powered transcription and searchable, timestamped playback.

---

## Overview

The podcast transcript feature provides:

- **Automated Transcription:** Uses AssemblyAI to generate word-level transcripts with speaker diarization
- **Cloud Storage:** Transcripts stored in Cloudflare R2 for cost-effective, scalable storage
- **Interactive Viewer:** Navigate transcript with timestamps, select text to create citations
- **Bidirectional Linking:** Jump between citations in highlights and their location in the transcript

---

## Architecture

### Components

1. **Python RAG Service** (`/fast-api`)
   - Handles transcript generation via AssemblyAI API
   - Uploads JSON transcripts to R2
   - Provides REST API for transcript retrieval

2. **Cloudflare R2**
   - Stores transcript JSON files
   - Bucket naming convention: `{environment}_root`
     - `environment` is the deployment environment name you choose (e.g., `localhost`, `dev`, `prod`)
     - Buckets are **created manually** in Cloudflare R2; the name is **not** derived automatically from `APP_ENV` or any other variable
     - For each environment, set `R2_BUCKET_NAME` to the full bucket name (e.g., `R2_BUCKET_NAME=localhost-root` for local, `R2_BUCKET_NAME=dev-root` for dev, `R2_BUCKET_NAME=prod-root` for production)
     - The `{environment}_root` pattern is a convention to keep buckets organized across environments; if you use a different pattern, it will still work as long as `R2_BUCKET_NAME` matches the actual bucket name
   - Public URLs for transcript access

3. **Database** (PostgreSQL)
   - `podcast_episodes.transcript_status`: Tracks generation status
   - `podcast_episodes.transcript_r2_key`: R2 object key for transcript JSON (URLs are generated dynamically from this key)
   - `podcast_episodes.transcript_error`: Error messages if generation fails

4. **Frontend** (`/frontend`)
   - Source detail page with "Transcript" tab
   - Sentence-by-sentence viewer with timestamps
   - Text selection for creating citations
   - Navigation from citations back to transcript

---

## Setup

### 1. AssemblyAI API Key

Get an API key from [AssemblyAI](https://www.assemblyai.com/)

**Features used:**
- Transcription with word-level timestamps
- Speaker diarization (identifies different speakers)
- High accuracy mode

### 2. Cloudflare R2 Setup

1. **Create R2 Bucket:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2
   - Create bucket with name: `{environment}_root`
     - Local dev: `localhost_root`
     - Development: `dev_root`
     - Production: `prod_root`

2. **Configure Public Access (Option A - Public Bucket):**
   - Enable "Allow Access" in bucket settings
   - Copy the public bucket URL (e.g., `https://pub-xxxxx.r2.dev`)
   - Use this as `R2_PUBLIC_URL_BASE`

3. **Configure Custom Domain (Option B - Custom Domain):**
   - Add custom domain in R2 settings (e.g., `transcripts.yourdomain.com`)
   - Configure DNS as instructed
   - Use custom domain as `R2_PUBLIC_URL_BASE`

4. **Generate API Tokens:**
   - Go to R2 → Manage R2 API Tokens
   - Create token with "Read & Write" permissions
   - Save `Access Key ID` and `Secret Access Key`
   - Note your `Account ID` from dashboard

### 3. Environment Variables

Configure the following variables (managed via Doppler for local development):

```bash
# AssemblyAI
ASSEMBLYAI_API_KEY=your-api-key-here

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=localhost_root  # Change per environment
R2_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
R2_PUBLIC_URL_BASE=https://pub-xxxxx.r2.dev  # Or your custom domain
```

**Note:** For local development, use `doppler run` to inject these variables. See `.env.example` for reference.

**Important:** The Python RAG service reads these variables from Doppler in local development.

---

## Usage

### Generating Transcripts

1. **Import Podcast:**
   - Navigate to `/podcasts`
   - Click "Import Podcast" and paste Apple Podcasts URL
   - Add episodes to your library

2. **Generate Transcript:**
   - Open a podcast source from your sources list
   - Go to "Transcript" tab
   - Click "Generate Transcript"
   - Wait a few minutes (status updates automatically)

3. **View Transcript:**
   - Once complete, transcript appears sentence-by-sentence
   - Timestamps shown on the left
   - Speaker labels shown if multiple speakers detected

### Creating Citations from Transcripts

1. **Select Text:**
   - Click on any sentence to select it
   - Or highlight text by dragging
   - Selected text is shown at bottom

2. **Create Citation (Coming Soon):**
   - Click "Create Citation" button
   - Citation dialog pre-fills with:
     - Selected text
     - Timestamp (`tStartSec`, `tEndSec` in location metadata)
     - Speaker information (if available)

### Navigation Between Highlights and Transcript

**From Highlights to Transcript:**
- Citations with timestamps show "Transcript" button
- Click to jump to that moment in the transcript
- Transcript automatically scrolls and highlights the relevant sentence

**From Transcript to Highlights:**
- Create citations from transcript selections
- Citations appear in the "Highlights" tab
- Linked by timestamp metadata

---

## Transcript Data Format

Transcripts are stored as JSON in R2 with this structure:

```json
{
  "full_text": "Complete transcript text...",
  "words": [
    {
      "text": "word",
      "start": 0.0,
      "end": 0.5,
      "confidence": 0.99,
      "speaker": "A"
    }
  ],
  "sentences": [
    {
      "text": "Full sentence with punctuation.",
      "start": 0.0,
      "end": 2.5,
      "confidence": 0.95,
      "speaker": "A"
    }
  ],
  "speakers": {
    "A": {
      "id": "A",
      "utterance_count": 15
    },
    "B": {
      "id": "B",
      "utterance_count": 12
    }
  },
  "metadata": {
    "id": "assemblyai-transcript-id",
    "audio_duration": 3600.5,
    "confidence": 0.92,
    "language_code": "en"
  }
}
```

---

## API Endpoints

### POST `/rag-api/transcript/generate`

Generate a transcript for an episode.

**Request:**
```json
{
  "episode_id": 123
}
```

**Response:**
```json
{
  "status": "pending",
  "url": null
}
```

**Status values:**
- `none`: Not generated yet
- `pending`: Generation in progress
- `completed`: Ready to view
- `failed`: Generation failed (see `transcript_error` in DB)

### GET `/rag-api/transcript/{episode_id}`

Get transcript generation status.

**Response:**
```json
{
  "status": "completed",
  "url": "https://pub-xxxxx.r2.dev/transcripts/123/2026-01-13T12:00:00.json"
}
```

### GET `/rag-api/transcript/{episode_id}/content`

Get full transcript content (only available when status is `completed`).

**Response:** Full transcript JSON (see format above)

---

## Cost Considerations

### AssemblyAI Pricing
- Pay-as-you-go: $0.00025/second (~$0.015/minute)
- 1-hour podcast: ~$0.90
- Subscription plans available for higher volume

### Cloudflare R2 Pricing
- Storage: $0.015/GB/month
- Class A Operations (writes): $4.50/million
- Class B Operations (reads): $0.36/million
- Egress: Free

**Estimated costs:**
- Average transcript: ~100KB JSON
- 1,000 transcripts: ~0.1GB storage = $0.0015/month
- Storage is negligible; transcription is the main cost

---

## Troubleshooting

### Transcript Generation Fails

**Check logs:**
```bash
docker logs fast-api
```

**Common issues:**
1. **AssemblyAI API key invalid:** Check `ASSEMBLYAI_API_KEY` is set correctly
2. **R2 credentials invalid:** Verify all R2 environment variables
3. **Audio URL unreachable:** Some podcasts block automated downloads
4. **Network timeout:** Large files may timeout; check `ASSEMBLYAI_TIMEOUT` setting

### Transcripts Not Displaying

1. **Check transcript_status in database:**
   ```sql
   SELECT id, title, transcript_status, transcript_error
   FROM podcast_episodes
   WHERE id = {episode_id};
   ```

2. **Verify R2 URL is accessible:**
   - Copy `transcript_r2_url` from database
   - Try accessing in browser
   - If 404, check R2 bucket public access settings

3. **Check browser console for errors:**
   - Open DevTools → Console
   - Look for fetch errors to `/rag-api/transcript/{id}/content`

### Background Task Not Running

The transcript generation happens in a background task using `asyncio.create_task()`.

**For production, consider:**
- Using Celery or similar task queue
- Adding job monitoring/retry logic
- Implementing webhook callbacks from AssemblyAI

---

## Future Enhancements

### Planned Features
- [ ] Citation dialog integration (auto-fill from transcript selection)
  - **Note:** Transcript text selection UI exists but citation dialog wiring is pending
- [ ] Search within transcripts
- [ ] Highlight keywords or phrases
- [ ] Audio player with transcript sync (click sentence → jump to audio position)
- [ ] Export transcripts (TXT, VTT, SRT formats)
- [ ] Batch transcript generation for entire shows
- [ ] Custom vocabulary/boost words for better accuracy

### Technical Improvements
- [ ] Proper background job queue (Celery)
- [ ] Retry logic for failed transcriptions
- [ ] Webhook support from AssemblyAI
- [ ] Caching strategy for frequently accessed transcripts
- [ ] Compression for large transcripts
- [ ] CDN integration for faster transcript delivery

---

## Related Documentation

- [Main Architecture Guide](../AGENTS.md)
- [RAG Service Documentation](../fast-api/AGENTS.md)
- [Deployment Guide](./DEPLOY.md)
- [Environment Variables](.env.example)
