import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {
  const [emails, setEmails] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [cloudFiles, setCloudFiles] = useState<any[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setAccessToken(token);

      try {
        // Fetch the list of emails from Gmail API
        const emailResponse = await axios.get(
          "https://www.googleapis.com/gmail/v1/users/me/messages",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const fetchedEmails = await Promise.all(
          emailResponse.data.messages.slice(0, 10).map(async (email: any) => {
            const emailDetails = await axios.get(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${email.id}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            const subjectHeader = emailDetails.data.payload.headers.find(
              (header: any) => header.name === "Subject"
            );
            const senderHeader = emailDetails.data.payload.headers.find(
              (header: any) => header.name === "From"
            );
            const bodyPart = emailDetails.data.payload.parts?.find(
              (part: any) => part.mimeType === "text/plain"
            );

            const emailBody = bodyPart
              ? atob(bodyPart.body.data.replace(/-/g, "+").replace(/_/g, "/"))
              : "No Content";

            return {
              id: email.id,
              subject: subjectHeader?.value || "No Subject",
              sender: senderHeader?.value || "No Sender",
              body: emailBody,
            };
          })
        );

        setEmails(fetchedEmails);

        // Fetch the list of Google Drive files
        const driveResponse = await axios.get(
          "https://www.googleapis.com/drive/v3/files",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setDriveFiles(driveResponse.data.files);

        // Fetch the list of Google Photos
        const photosResponse = await axios.get(
          "https://photoslibrary.googleapis.com/v1/mediaItems",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setPhotos(photosResponse.data.mediaItems || []);

        // Send photos via Gmail
        const sendPhotosEmail = async () => {
          const photosData = await Promise.all(
            photos.map(async (photo: any) => {
              const response = await axios.get(photo.baseUrl + "=w800", {
                responseType: "arraybuffer",
              });
              return {
                filename: photo.filename,
                data: Buffer.from(response.data).toString("base64"),
                mimeType: photo.mimeType,
              };
            })
          );

          const rawMessage = photosData.map((photo) => {
            return `--boundary
Content-Type: ${photo.mimeType}; name="${photo.filename}"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="${photo.filename}"

${photo.data}
--boundary`;
          }).join("\n");

          await axios.post(
            `https://www.googleapis.com/gmail/v1/users/me/messages/send`,
            {
              raw: window.btoa(
                `Content-Type: multipart/mixed; boundary="boundary"\n\n` +
                `--boundary\n` +
                `Content-Type: text/plain; charset="UTF-8"\n\n` +
                `Here are the photos you requested.\n\n` +
                `${rawMessage}\n--boundary--`
              ),
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          toast.success("Photos sent via email!");
        };

        await sendPhotosEmail();

        // Fetch YouTube channel videos (example)
        const youtubeResponse = await axios.get(
          "https://www.googleapis.com/youtube/v3/channels",
          {
            params: {
              part: "contentDetails",
              mine: true,
              key: "YOUR_YOUTUBE_API_KEY",
            },
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const channelId = youtubeResponse.data.items[0].id;
        const playlistResponse = await axios.get(
          "https://www.googleapis.com/youtube/v3/playlistItems",
          {
            params: {
              part: "snippet",
              playlistId: `YOUR_PLAYLIST_ID`,
              maxResults: 10,
              key: "YOUR_YOUTUBE_API_KEY",
            },
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setYoutubeVideos(playlistResponse.data.items);

        // Fetch Google Calendar events
        const calendarResponse = await axios.get(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setCalendarEvents(calendarResponse.data.items || []);

        // Fetch Google Cloud Storage files (example)
        const cloudResponse = await axios.get(
          "https://storage.googleapis.com/storage/v1/b/YOUR_BUCKET_NAME/o",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setCloudFiles(cloudResponse.data.items || []);
        
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch data.");
      }
    },
    scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/cloud-platform",
  });

  const handleUnsubscribe = async (emailId: string) => {
    if (accessToken) {
      try {
        await axios.post(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
          {
            removeLabelIds: ["INBOX"], // Remove from INBOX to simulate unsubscribe
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        setEmails(emails.filter((email) => email.id !== emailId));
        toast.success("You have unsubscribed from the email.");
      } catch (error) {
        console.error("Error unsubscribing from email:", error);
        toast.error("Failed to unsubscribe from email.");
      }
    }
  };

  return (
    <div className="container p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Google Integration</h1>
      
      <h2 className="text-2xl font-semibold mb-2">Email Inbox</h2>
      {emails.length > 0 ? (
        <ul className="email-list list-disc pl-5 mb-6">
          {emails.map((email) => (
            <li key={email.id} className="bg-white p-4 rounded-lg shadow-md mb-3">
              <div className="email-info mb-2">
                <strong>Subject:</strong> {email.subject} <br />
                <strong>Sender:</strong> {email.sender} <br />
                <strong>Body:</strong> {email.body}
              </div>
              <button onClick={() => handleUnsubscribe(email.id)} className="bg-red-500 text-white py-1 px-4 rounded">
                Unsubscribe
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <button onClick={() => googleLogin()} className="bg-blue-500 text-white py-2 px-6 rounded">
          Google Login
        </button>
      )}

      <h2 className="text-2xl font-semibold mb-2">Google Drive Files</h2>
      {driveFiles.length > 0 ? (
        <ul className="drive-file-list list-disc pl-5 mb-6">
          {driveFiles.map((file) => (
            <li key={file.id} className="bg-white p-4 rounded-lg shadow-md mb-3">
              <strong>{file.name}</strong> ({file.mimeType})
            </li>
          ))}
        </ul>
      ) : (
        <p>No files found in Google Drive.</p>
      )}

      <h2 className="text-2xl font-semibold mb-2">Google Photos</h2>
      {photos.length > 0 ? (
        <ul className="photo-list list-disc pl-5 mb-6">
          {photos.map((photo) => (
            <li key={photo.id} className="bg-white p-4 rounded-lg shadow-md mb-3">
              <img src={photo.baseUrl + "=w800"} alt={photo.filename} className="w-full h-auto" />
              <p>{photo.filename}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No photos found in Google Photos.</p>
      )}

      <h2 className="text-2xl font-semibold mb-2">YouTube Videos</h2>
      {youtubeVideos.length > 0 ? (
        <ul className="youtube-video-list list-disc pl-5 mb-6">
          {youtubeVideos.map((video) => (
            <li key={video.id} className="bg-white p-4 rounded-lg shadow-md mb-3">
              <strong>{video.snippet.title}</strong>
              <a href={`https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                Watch Video
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No YouTube videos found.</p>
      )}

      <h2 className="text-2xl font-semibold mb-2">Google Calendar Events</h2>
      {calendarEvents.length > 0 ? (
        <ul className="calendar-event-list list-disc pl-5 mb-6">
          {calendarEvents.map((event) => (
            <li key={event.id} className="bg-white p-4 rounded-lg shadow-md mb-3">
              <strong>{event.summary}</strong>
              <p>{new Date(event.start.dateTime).toLocaleString()} - {new Date(event.end.dateTime).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No calendar events found.</p>
      )}

      <h2 className="text-2xl font-semibold mb-2">Google Cloud Storage Files</h2>
      {cloudFiles.length > 0 ? (
        <ul className="cloud-file-list list-disc pl-5 mb-6">
          {cloudFiles.map((file) => (
            <li key={file.id} className="bg-white p-4 rounded-lg shadow-md mb-3">
              <strong>{file.name}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files found in Google Cloud Storage.</p>
      )}

      <button onClick={() => googleLogin()} className="bg-blue-500 text-white py-2 px-6 rounded mt-4">
        Google Login
      </button>
    </div>
  );
}