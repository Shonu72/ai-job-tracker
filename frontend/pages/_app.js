import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>AI Job Application Tracker — Autonomous Gemini Powered</title>
        <meta name="description" content="Track your job applications, generate grounded cover letters and follow-up emails using Vertex AI Gemini, and automate follow-up nudges." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎯</text></svg>" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
