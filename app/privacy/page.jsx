export const metadata = {
  title: "Privacy Policy - Fabrica Foodie",
};

export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px", lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: June 1, 2026</p>

      <h2>What Fabrica Foodie Does</h2>
      <p>
        Fabrica Foodie helps Threads users save food recommendations into a personal food library.
        When you mention @fabrica_tw on Threads, we may process that content to create a saved food card.
      </p>

      <h2>Information We Collect</h2>
      <p>We may collect and store:</p>
      <ul>
        <li>Your Threads username</li>
        <li>Threads content where @fabrica_tw is mentioned</li>
        <li>Restaurant or food names extracted from the content</li>
        <li>Area hints, notes, source links, and media URLs when available</li>
        <li>Verification codes used to connect your Threads username to your Fabrica Foodie library</li>
      </ul>

      <h2>How We Use Information</h2>
      <p>
        We use this information to create, display, and manage your personal food library.
        We may use AI services to summarize or extract restaurant information from Threads content.
      </p>

      <h2>Data Sharing</h2>
      <p>
        We do not sell your personal information. We may use service providers such as hosting,
        database, and AI processing providers only to operate Fabrica Foodie.
      </p>

      <h2>Data Deletion</h2>
      <p>
        You may request deletion of your Fabrica Foodie data by contacting us.
        Please include your Threads username in the request.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or deletion requests, contact: your-email@example.com
      </p>
    </main>
  );
}