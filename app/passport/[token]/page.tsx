export default function PublicPassportPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white flex-col gap-3">
      <p style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>/passport/[token]</p>
      <p style={{ fontSize: 13, color: '#6B7280' }}>Public — no auth required</p>
    </div>
  )
}
