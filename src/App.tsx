import { useEffect, useMemo, useState } from 'react'
import './App.css'

type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
type Donor = {
  id: string
  name: string
  bloodGroup: BloodGroup
  city: string
  area: string
  phone: string
  available: boolean
  lastDonation: string
  sharePhone?: boolean
  coordinates?: { latitude: number; longitude: number }
  demo?: boolean
}
type DonorResponse = { donorId: string; donorName: string; respondedAt: string }
type BloodRequest = {
  id: string
  patient: string
  bloodGroup: BloodGroup
  units: number
  city: string
  hospital: string
  urgency: 'Critical' | 'Urgent' | 'Routine'
  contact: string
  note: string
  status: 'Open' | 'Fulfilled' | 'Closed' | 'Expired'
  createdAt: string
  expiresAt?: string
  responses?: DonorResponse[]
  requesterDonorId?: string
}
type Facility = { id: string; name: string; city: string; address: string; phone: string; createdAt: string }
type StockItem = { bloodGroup: BloodGroup; units: number; updatedAt: string }
type Donation = { id: string; donorName: string; bloodGroup: BloodGroup; units: number; donatedAt: string; status: 'Completed' | 'Scheduled' }
type BloodCamp = { id: string; name: string; city: string; venue: string; date: string; capacity: number; contact: string }
type AppView = 'dashboard' | 'discover' | 'register' | 'requests' | 'facilities' | 'inventory' | 'donations' | 'camps' | 'profile'

const bloodGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const todayDate = new Date().toISOString().slice(0, 10)
const compatibleDonorGroups: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': bloodGroups,
}
const donorKey = 'lifelink.donors.v1'
const requestKey = 'lifelink.requests.v1'
const profileKey = 'lifelink.profile.v1'
const facilityKey = 'lifelink.facilities.v1'
const stockKey = 'lifelink.stock.v1'
const donationKey = 'lifelink.donations.v1'
const campKey = 'lifelink.camps.v1'
const initialStock: StockItem[] = bloodGroups.map((bloodGroup, index) => ({ bloodGroup, units: [12, 4, 8, 3, 5, 2, 10, 1][index], updatedAt: new Date().toISOString() }))
const demoCityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Mumbai: { latitude: 19.076, longitude: 72.8777 },
  Pune: { latitude: 18.5204, longitude: 73.8567 },
  Hyderabad: { latitude: 17.385, longitude: 78.4867 },
}
const demoDonors: Donor[] = [
  { id: 'demo-1', name: 'Aarav Mehta', bloodGroup: 'O+', city: 'Mumbai', area: 'Bandra West', phone: '', available: true, lastDonation: 'Feb 2026', demo: true },
  { id: 'demo-2', name: 'Ananya Rao', bloodGroup: 'A-', city: 'Mumbai', area: 'Andheri East', phone: '', available: true, lastDonation: 'Jan 2026', demo: true },
  { id: 'demo-3', name: 'Kabir Shah', bloodGroup: 'B+', city: 'Pune', area: 'Koregaon Park', phone: '', available: true, lastDonation: 'Mar 2026', demo: true },
  { id: 'demo-4', name: 'Diya Nair', bloodGroup: 'AB+', city: 'Hyderabad', area: 'Jubilee Hills', phone: '', available: false, lastDonation: 'Apr 2026', demo: true },
  { id: 'demo-5', name: 'Ishaan Kapoor', bloodGroup: 'O-', city: 'Mumbai', area: 'Powai', phone: '', available: true, lastDonation: 'Dec 2025', demo: true },
  { id: 'demo-6', name: 'Mira Iyer', bloodGroup: 'B-', city: 'Pune', area: 'Baner', phone: '', available: true, lastDonation: 'Feb 2026', demo: true },
]

function readStorage<T,>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : fallback
  } catch {
    return fallback
  }
}

function distanceBetween(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(destination.latitude - origin.latitude)
  const longitudeDelta = radians(destination.longitude - origin.longitude)
  const arc = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc)))
}

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function App() {
  const [donors, setDonors] = useState<Donor[]>(() => readStorage(donorKey, demoDonors))
  const [requests, setRequests] = useState<BloodRequest[]>(() => readStorage(requestKey, []))
  const [facilities, setFacilities] = useState<Facility[]>(() => readStorage(facilityKey, []))
  const [stock, setStock] = useState<StockItem[]>(() => readStorage(stockKey, initialStock))
  const [donations, setDonations] = useState<Donation[]>(() => readStorage(donationKey, []))
  const [camps, setCamps] = useState<BloodCamp[]>(() => readStorage(campKey, []))
  const [profileId, setProfileId] = useState<string | null>(() => readStorage(profileKey, null))
  const [view, setView] = useState<AppView>('dashboard')
  const [groupFilter, setGroupFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState(true)
  const [requestPrefill, setRequestPrefill] = useState<{ bloodGroup: BloodGroup; city: string } | null>(null)
  const [searchOrigin, setSearchOrigin] = useState<{ latitude: number; longitude: number } | null>(null)
  const [notice, setNotice] = useState('')
  const profile = donors.find((donor) => donor.id === profileId)

  useEffect(() => localStorage.setItem(donorKey, JSON.stringify(donors)), [donors])
  useEffect(() => localStorage.setItem(requestKey, JSON.stringify(requests)), [requests])
  useEffect(() => localStorage.setItem(facilityKey, JSON.stringify(facilities)), [facilities])
  useEffect(() => localStorage.setItem(stockKey, JSON.stringify(stock)), [stock])
  useEffect(() => localStorage.setItem(donationKey, JSON.stringify(donations)), [donations])
  useEffect(() => localStorage.setItem(campKey, JSON.stringify(camps)), [camps])
  useEffect(() => {
    if (profileId) localStorage.setItem(profileKey, JSON.stringify(profileId))
    else localStorage.removeItem(profileKey)
  }, [profileId])
  useEffect(() => {
    const expireRequests = () => setRequests((current) => current.map((request) =>
      request.status === 'Open' && request.expiresAt && Date.parse(request.expiresAt) <= Date.now()
        ? { ...request, status: 'Expired' }
        : request,
    ))
    expireRequests()
    const timer = window.setInterval(expireRequests, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const filteredDonors = useMemo(() => donors.filter((donor) =>
    (!groupFilter || compatibleDonorGroups[groupFilter as BloodGroup]?.includes(donor.bloodGroup)) &&
    (!cityFilter || `${donor.city} ${donor.area}`.toLowerCase().includes(cityFilter.toLowerCase())) &&
    (!availabilityFilter || donor.available),
  ).map((donor) => {
    const destination = donor.coordinates ?? demoCityCoordinates[donor.city]
    return {
      ...donor,
      distanceKm: searchOrigin && destination ? distanceBetween(searchOrigin, destination) : null,
      approximateDistance: !donor.coordinates && Boolean(demoCityCoordinates[donor.city]),
    }
  }).sort((first, second) => searchOrigin ? (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity) : 0), [availabilityFilter, cityFilter, donors, groupFilter, searchOrigin])

  function registerDonor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const existing = donors.find((donor) => donor.id === profileId)
    const donor: Donor = {
      id: existing?.id ?? crypto.randomUUID(),
      name: String(form.get('name')).trim(),
      bloodGroup: String(form.get('bloodGroup')) as BloodGroup,
      city: String(form.get('city')).trim(),
      area: String(form.get('area')).trim(),
      phone: String(form.get('phone')).trim(),
      available: existing?.available ?? true,
      lastDonation: String(form.get('lastDonation') || 'Not shared'),
      sharePhone: form.get('sharePhone') === 'on',
      coordinates: form.get('saveLocation') === 'on' ? searchOrigin ?? existing?.coordinates : undefined,
    }
    setDonors((current) => existing ? current.map((item) => item.id === existing.id ? donor : item) : [donor, ...current])
    setProfileId(donor.id)
    setNotice(existing ? 'Your donor profile has been updated.' : 'You are now listed as a donor.')
    setView('profile')
    event.currentTarget.reset()
  }

  function createRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const request: BloodRequest = {
      id: crypto.randomUUID(),
      patient: String(form.get('patient')).trim(),
      bloodGroup: String(form.get('bloodGroup')) as BloodGroup,
      units: Number(form.get('units')),
      city: String(form.get('city')).trim(),
      hospital: String(form.get('hospital')).trim(),
      urgency: String(form.get('urgency')) as BloodRequest['urgency'],
      contact: String(form.get('contact')).trim(),
      note: String(form.get('note')).trim(),
      status: 'Open',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      responses: [],
      requesterDonorId: profileId ?? undefined,
    }
    setRequests((current) => [request, ...current])
    setNotice('Your request has been saved on this device.')
    event.currentTarget.reset()
    setView('requests')
  }

  function changeAvailability() {
    if (!profile) return
    setDonors((current) => current.map((donor) => donor.id === profile.id ? { ...donor, available: !donor.available } : donor))
    setNotice(`Availability set to ${profile.available ? 'unavailable' : 'available'}.`)
  }

  function changeRequestStatus(id: string) {
    setRequests((current) => current.map((request) => request.id === id && request.status === 'Open' ? { ...request, status: 'Fulfilled' } : request))
  }

  function closeRequest(id: string) {
    setRequests((current) => current.map((request) => request.id === id && request.status === 'Open' ? { ...request, status: 'Closed' } : request))
  }

  function respondToRequest(request: BloodRequest) {
    if (!profile) {
      setNotice('Register a donor profile before responding to a request.')
      setView('register')
      return
    }
    if (!profile.available) {
      setNotice('Set your donor availability to available before responding.')
      setView('profile')
      return
    }
    if (!compatibleDonorGroups[request.bloodGroup].includes(profile.bloodGroup)) {
      setNotice(`Your ${profile.bloodGroup} profile does not match the listed ${request.bloodGroup} red-cell compatibility groups. Confirm with the hospital.`)
      return
    }
    setRequests((current) => current.map((item) => item.id === request.id
      ? { ...item, responses: [...(item.responses ?? []).filter((response) => response.donorId !== profile.id), { donorId: profile.id, donorName: profile.name, respondedAt: new Date().toISOString() }] }
      : item,
    ))
    setNotice('Your response was saved on this device. The requester will not be notified.')
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNotice('Location services are unavailable in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setNotice('Nearby results are sorted by distance. Sample directory distances are approximate.')
      },
      () => setNotice('Location was not shared. You can still search by city or neighborhood.'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  function addFacility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const facility: Facility = {
      id: crypto.randomUUID(),
      name: String(form.get('name')).trim(),
      city: String(form.get('city')).trim(),
      address: String(form.get('address')).trim(),
      phone: String(form.get('phone')).trim(),
      createdAt: new Date().toISOString(),
    }
    setFacilities((current) => [facility, ...current])
    setNotice('Facility saved on this device. Details are community-submitted and not independently verified.')
    event.currentTarget.reset()
  }

  function updateStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const group = String(form.get('bloodGroup')) as BloodGroup
    const units = Number(form.get('units'))
    setStock((current) => current.map((item) => item.bloodGroup === group ? { ...item, units, updatedAt: new Date().toISOString() } : item))
    setNotice(`${group} stock updated on this device.`)
    event.currentTarget.reset()
  }

  function addDonation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const group = String(form.get('bloodGroup')) as BloodGroup
    const units = Number(form.get('units'))
    const donation: Donation = { id: crypto.randomUUID(), donorName: String(form.get('donorName')).trim(), bloodGroup: group, units, donatedAt: String(form.get('donatedAt')), status: 'Completed' }
    setDonations((current) => [donation, ...current])
    setStock((current) => current.map((item) => item.bloodGroup === group ? { ...item, units: item.units + units, updatedAt: new Date().toISOString() } : item))
    setNotice('Donation logged and local stock updated.')
    event.currentTarget.reset()
  }

  function addCamp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const camp: BloodCamp = { id: crypto.randomUUID(), name: String(form.get('name')).trim(), city: String(form.get('city')).trim(), venue: String(form.get('venue')).trim(), date: String(form.get('date')), capacity: Number(form.get('capacity')), contact: String(form.get('contact')).trim() }
    setCamps((current) => [camp, ...current])
    setNotice('Blood camp saved on this device.')
    event.currentTarget.reset()
  }

  const tabs = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'discover', label: 'Find donors' },
    { id: 'register', label: profile ? 'Edit donor details' : 'Become a donor' },
    { id: 'requests', label: 'Blood requests' },
    { id: 'facilities', label: 'Blood banks' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'donations', label: 'Donations' },
    { id: 'camps', label: 'Blood camps' },
  ] as const

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => setView('discover')} aria-label="LifeLink home">
          <span className="brand-mark" aria-hidden="true"><span>L</span></span>
          <span className="brand-name">life<span>link</span></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {tabs.slice(0, 4).map((tab) => <button key={tab.id} className={view === tab.id ? 'nav-link active' : 'nav-link'} onClick={() => setView(tab.id)}>{tab.label}</button>)}
        </nav>
        <button className="profile-button" onClick={() => setView('profile')}>
          <span className="profile-dot">{profile?.name.slice(0, 1) ?? '♡'}</span>
          <span>{profile ? 'My profile' : 'Your profile'}</span>
        </button>
      </header>

      <main id="home">
        <div className="emergency-notice"><span className="emergency-mark">!</span><p><strong>Need blood urgently?</strong> Contact the hospital blood bank or local emergency services directly. LifeLink is a community directory and is not monitored.</p></div>
        <section className="welcome-row">
          <div>
            <p className="eyebrow"><span className="live-dot" /> COMMUNITY DONOR NETWORK</p>
            <h1>Small act.<br /><em>Second chance.</em></h1>
            <p className="welcome-copy">Find nearby blood donors, or make yourself available to someone who needs you.</p>
          </div>
          <aside className="welcome-aside">
            <span className="aside-number">{donors.filter((donor) => donor.available).length.toString().padStart(2, '0')}</span>
            <span className="aside-label">donors currently<br />available in this directory</span>
            <span className="aside-rule" />
            <span className="aside-note">Every connection begins with a simple search.</span>
          </aside>
        </section>

        <div className="workspace">
          <aside className="side-panel">
            <p className="side-heading">WORKSPACE</p>
            <button className={view === 'dashboard' ? 'side-link selected' : 'side-link'} onClick={() => setView('dashboard')}><span className="side-icon">▦</span>Overview</button>
            <button className={view === 'discover' ? 'side-link selected' : 'side-link'} onClick={() => setView('discover')}><span className="side-icon">⌕</span>Find a donor <span className="side-arrow">→</span></button>
            <button className={view === 'register' ? 'side-link selected' : 'side-link'} onClick={() => setView('register')}><span className="side-icon">＋</span>Register as donor</button>
            <button className={view === 'requests' ? 'side-link selected' : 'side-link'} onClick={() => setView('requests')}><span className="side-icon">▤</span>Blood requests <span className="count-badge">{requests.length}</span></button>
            <button className={view === 'facilities' ? 'side-link selected' : 'side-link'} onClick={() => setView('facilities')}><span className="side-icon">+</span>Blood banks & hospitals</button>
            <button className={view === 'inventory' ? 'side-link selected' : 'side-link'} onClick={() => setView('inventory')}><span className="side-icon">◉</span>Blood inventory</button>
            <button className={view === 'donations' ? 'side-link selected' : 'side-link'} onClick={() => setView('donations')}><span className="side-icon">♥</span>Donation history</button>
            <button className={view === 'camps' ? 'side-link selected' : 'side-link'} onClick={() => setView('camps')}><span className="side-icon">▣</span>Blood camps</button>
            <div className="side-divider" />
            <div className="promise-block">
              <span className="promise-icon">✳</span>
              <p>Here for each other.</p>
              <span>One community. A little more hope.</span>
            </div>
            <div className="local-note"><span className="lock-mark">⌑</span><span><strong>Private by default</strong><br />Your information stays in this browser.</span></div>
          </aside>

          <section className="content-panel">
            {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
            {view === 'dashboard' && <>
              <div className="dashboard-title"><div><p className="eyebrow">LIFELINK COMMUNITY OPERATIONS</p><h2>Blood network overview</h2><p>Local activity and community-managed records at a glance.</p></div><span className="local-data-badge">LOCAL DEMO DATA</span></div>
              <div className="metric-grid"><article className="metric-card metric-red"><span>Registered donors</span><strong>{donors.length}</strong><small>{donors.filter((donor) => donor.available).length} currently available</small></article><article className="metric-card metric-blue"><span>Facilities</span><strong>{facilities.length}</strong><small>Community-submitted</small></article><article className="metric-card metric-green"><span>Blood requests</span><strong>{requests.filter((request) => request.status === 'Open').length}</strong><small>{requests.filter((request) => request.status === 'Fulfilled').length} fulfilled</small></article><article className="metric-card metric-amber"><span>Donations logged</span><strong>{donations.length}</strong><small>{donations.reduce((total, donation) => total + donation.units, 0)} units recorded</small></article></div>
              <div className="dashboard-columns"><section className="dashboard-section stock-preview"><div className="dashboard-section-heading"><div><h3>Blood stock snapshot</h3><p>Illustrative starting values · update before use</p></div><button className="small-link" onClick={() => setView('inventory')}>Manage stock →</button></div><div className="stock-bars">{stock.map((item) => <div className="stock-row" key={item.bloodGroup}><strong>{item.bloodGroup}</strong><div className="stock-track"><span className={item.units < 4 ? 'stock-fill low' : 'stock-fill'} style={{ width: `${Math.min(100, item.units * 4)}%` }} /></div><span className={item.units < 4 ? 'stock-units low-stock' : 'stock-units'}>{item.units} units</span></div>)}</div></section><section className="dashboard-section urgent-preview"><div className="dashboard-section-heading"><div><h3>Open requests</h3><p>Priority follow-up list</p></div><button className="small-link" onClick={() => setView('requests')}>View all →</button></div>{requests.filter((request) => request.status === 'Open').slice(0, 4).map((request) => <div className="mini-request" key={request.id}><span className="blood-chip">{request.bloodGroup}</span><div><strong>{request.patient}</strong><small>{request.hospital}, {request.city}</small></div><span className={`urgency ${request.urgency.toLowerCase()}`}>{request.urgency}</span></div>)}{requests.filter((request) => request.status === 'Open').length === 0 && <div className="dashboard-empty">No open requests in this browser.</div>}</section></div>
              <section className="quick-actions"><h3>Quick actions</h3><div className="quick-action-grid"><button onClick={() => setView('register')}><span>＋</span><strong>Register donor</strong><small>Add a volunteer profile</small></button><button onClick={() => setView('requests')}><span>!</span><strong>Post blood request</strong><small>Record an urgent need</small></button><button onClick={() => setView('donations')}><span>♥</span><strong>Log donation</strong><small>Update local history</small></button><button onClick={() => setView('camps')}><span>▣</span><strong>Plan blood camp</strong><small>Add a community event</small></button></div></section>
              <p className="dashboard-disclaimer">Demo workspace only. Records are stored in this browser and are not shared with hospitals or other users.</p>
            </>}
            {view === 'discover' && <>
              <div className="section-heading">
                <div><p className="eyebrow">A MATCH COULD BE CLOSER THAN YOU THINK</p><h2>Find a blood donor</h2></div>
                <button className="button button-dark" onClick={() => setView('requests')}>＋ <span>Post a request</span></button>
              </div>
              <div className="search-panel">
                <label className="field"><span>Patient blood group</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="">All blood groups</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label className="field location-field"><span>City or neighborhood</span><input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="e.g. Mumbai, Bandra" /></label>
                <label className="availability-control"><input type="checkbox" checked={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.checked)} /><span className="check-visual" /><span>Available now</span></label>
                <button className="location-button" onClick={useMyLocation}>{searchOrigin ? 'Location enabled · nearest first' : 'Use my location'}</button>
              </div>
              <div className="result-heading"><div><h3>{groupFilter ? 'Compatible donors' : 'Nearby donors'} <span className="result-count">{filteredDonors.length}</span></h3><p>{groupFilter ? `Showing donor blood groups compatible with ${groupFilter} red-cell needs. Confirm compatibility with the hospital.` : 'People who have chosen to be part of the network.'}</p></div><span className="demo-tag">SAMPLE DIRECTORY</span></div>
              {filteredDonors.length ? <div className="donor-grid">{filteredDonors.map((donor) => <article className="donor-card" key={donor.id}>
                <div className="donor-top"><div className="avatar">{donor.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><span className={donor.available ? 'status available' : 'status unavailable'}><i />{donor.available ? 'Available' : 'Unavailable'}</span></div>
                <div className="donor-name-row"><h4>{donor.name}</h4>{donor.demo && <span className="demo-label">DEMO</span>}</div>
                <p className="donor-location">{donor.area}, {donor.city}</p>
                <div className="donor-meta"><span className="blood-chip">{donor.bloodGroup}</span><span>Last donation · {donor.lastDonation}</span></div>
                <div className="donor-reliability"><span>Donor self-reported</span>{donor.distanceKm !== null && <span>{donor.approximateDistance ? '~' : ''}{donor.distanceKm} km{donor.approximateDistance ? ' · city center estimate' : ''}</span>}</div>
                {donor.sharePhone && donor.phone && !donor.demo && <div className="donor-contact-actions"><a href={`tel:${donor.phone}`}>Call donor</a><a href={`https://wa.me/${donor.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Message</a></div>}
                <button className="text-action" onClick={() => { setRequestPrefill({ bloodGroup: groupFilter ? groupFilter as BloodGroup : donor.bloodGroup, city: donor.city }); setView('requests'); setNotice(`Request form started for ${groupFilter || donor.bloodGroup} in ${donor.city}.`) }}>Start a matching request <span>→</span></button>
              </article>)}</div> : <div className="empty-state"><span className="empty-mark">⌕</span><h3>No matching donors yet</h3><p>Try a different blood group or a nearby city.</p><button className="button button-outline" onClick={() => { setGroupFilter(''); setCityFilter('') }}>Clear filters</button></div>}
            </>}

            {view === 'register' && <>
              <div className="section-heading"><div><p className="eyebrow">A FEW DETAILS CAN HELP SOMEONE</p><h2>{profile ? 'Update your donor profile' : 'Become a donor'}</h2><p className="section-copy">Share the basics. You can change your availability any time.</p></div></div>
              <form className="form-panel" onSubmit={registerDonor}>
                <div className="form-grid">
                  <label className="field"><span>Full name</span><input name="name" required maxLength={70} defaultValue={profile?.name ?? ''} placeholder="Your name" /></label>
                  <label className="field"><span>Blood group</span><select name="bloodGroup" required defaultValue={profile?.bloodGroup ?? ''}><option value="" disabled>Select group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label>
                  <label className="field"><span>City</span><input name="city" required maxLength={80} defaultValue={profile?.city ?? ''} placeholder="Your city" /></label>
                  <label className="field"><span>Neighborhood</span><input name="area" required maxLength={100} defaultValue={profile?.area ?? ''} placeholder="Area or neighborhood" /></label>
                  <label className="field"><span>Phone number</span><input name="phone" type="tel" required maxLength={25} defaultValue={profile?.phone ?? ''} placeholder="For coordination" /></label>
                  <label className="field"><span>Last donated <small>(optional)</small></span><input name="lastDonation" defaultValue={profile?.lastDonation === 'Not shared' ? '' : profile?.lastDonation ?? ''} placeholder="e.g. March 2026" /></label>
                </div>
                <div className="consent-options"><label><input type="checkbox" name="sharePhone" defaultChecked={profile?.sharePhone ?? false} /><span><strong>Allow direct contact</strong><small>Show my number to people viewing this browser’s directory. I can turn this off later.</small></span></label><label><input type="checkbox" name="saveLocation" defaultChecked={Boolean(profile?.coordinates)} /><span><strong>Use my current location for distance matching</strong><small>Location is optional and stays in this browser. You can skip it.</small></span></label><button type="button" className="text-action location-action" onClick={useMyLocation}>Set my approximate location <span>⌖</span></button></div>
                <div className="form-foot"><p><span>i</span> Last donation is self-reported. Ask healthcare staff about eligibility.</p><button type="submit" className="button button-red">{profile ? 'Save changes' : 'Join the donor list'} <span>→</span></button></div>
              </form>
            </>}

            {view === 'requests' && <>
              <div className="section-heading"><div><p className="eyebrow">ASK YOUR COMMUNITY</p><h2>Blood requests</h2><p className="section-copy">Post a need and keep track of the request on this device.</p></div></div>
              <form className="form-panel request-form" onSubmit={createRequest}>
                <h3>Submit a blood request</h3>
                <div className="form-grid">
                  <label className="field"><span>Patient name or initials</span><input name="patient" required maxLength={70} placeholder="Use initials to limit personal data" /></label>
                  <label className="field"><span>Patient blood group</span><select name="bloodGroup" required key={requestPrefill?.bloodGroup ?? 'empty'} defaultValue={requestPrefill?.bloodGroup ?? ''}><option value="" disabled>Select group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label>
                  <label className="field"><span>Units needed</span><input name="units" type="number" min="1" max="20" defaultValue="1" required /></label>
                  <label className="field"><span>Urgency</span><select name="urgency" defaultValue="Urgent"><option>Critical</option><option>Urgent</option><option>Routine</option></select></label>
                  <label className="field"><span>City</span><input name="city" required maxLength={80} defaultValue={requestPrefill?.city ?? ''} placeholder="City" /></label>
                  <label className="field"><span>Hospital or location</span><input name="hospital" required maxLength={120} placeholder="Hospital name or area" /></label>
                  <label className="field"><span>Contact number</span><input name="contact" type="tel" required maxLength={25} placeholder="For coordination" /></label>
                  <label className="field"><span>Additional details <small>(optional)</small></span><input name="note" maxLength={200} placeholder="Anything donors should know" /></label>
                </div>
                <div className="form-foot"><p><span>ⓘ</span> This local demo does not contact donors or hospitals.</p><button type="submit" className="button button-red">Save blood request <span>→</span></button></div>
              </form>
              <div className="requests-list"><div className="result-heading"><div><h3>Your requests <span className="result-count">{requests.length}</span></h3><p>Saved locally in your browser.</p></div></div>
                {requests.length ? requests.map((request) => <article className="request-card" key={request.id}>
                  <div className="request-type"><span className="blood-chip">{request.bloodGroup}</span><span className={`urgency ${request.urgency.toLowerCase()}`}>{request.urgency}</span></div>
                  <div className="request-details"><h4>{request.patient} <span>· {request.units} {request.units === 1 ? 'unit' : 'units'}</span></h4><p>{request.hospital}, {request.city}</p><small>{formatDate(request.createdAt)} · {request.status}{request.expiresAt && request.status === 'Open' ? ` · expires ${formatDate(request.expiresAt)}` : ''}</small>{request.note && <p className="request-note">{request.note}</p>}<p className="response-list">{request.responses?.length ? `Interested donors: ${request.responses.map((response) => response.donorName).join(', ')}` : 'No donor responses yet'}</p><button className="status-button response-button" disabled={request.status !== 'Open' || request.requesterDonorId === profile?.id || request.responses?.some((response) => response.donorId === profile?.id)} onClick={() => respondToRequest(request)}>{request.responses?.some((response) => response.donorId === profile?.id) ? 'Response saved' : 'I can help'}</button></div>
                  <div className="request-actions"><span className={`request-state ${request.status.toLowerCase()}`}>{request.status}</span>{request.status === 'Open' && <><button className="status-button done" onClick={() => changeRequestStatus(request.id)}>Fulfilled</button><button className="status-button" onClick={() => closeRequest(request.id)}>Close</button></>}</div>
                </article>) : <div className="empty-requests">No requests posted yet.</div>}
              </div>
            </>}

            {view === 'facilities' && <>
              <div className="section-heading"><div><p className="eyebrow">LOCAL CARE, DIRECTLY</p><h2>Blood banks & hospitals</h2><p className="section-copy">For urgent needs, contact a hospital blood bank directly. Directory entries are community-added and are not verified by LifeLink.</p></div><a className="button button-dark" href={`https://www.google.com/maps/search/${encodeURIComponent(`blood bank ${cityFilter || 'near me'}`)}`} target="_blank" rel="noreferrer">Search maps <span>↗</span></a></div>
              <form className="form-panel facility-form" onSubmit={addFacility}><h3>Add a local facility</h3><div className="form-grid"><label className="field"><span>Facility name</span><input name="name" required maxLength={100} placeholder="Hospital or blood bank" /></label><label className="field"><span>City</span><input name="city" required maxLength={80} placeholder="City" /></label><label className="field"><span>Address or neighborhood</span><input name="address" required maxLength={150} placeholder="Street, area or landmark" /></label><label className="field"><span>Public contact number</span><input name="phone" type="tel" required maxLength={25} placeholder="Include country code" /></label></div><div className="form-foot"><p>Community-submitted. Confirm details with the facility.</p><button type="submit" className="button button-red">Save facility</button></div></form>
              <div className="facility-list"><div className="result-heading"><div><h3>Community directory <span className="result-count">{facilities.length}</span></h3><p>Saved only in this browser. No facility has been independently verified.</p></div></div>{facilities.length ? facilities.map((facility) => <article className="facility-row" key={facility.id}><div className="facility-symbol" aria-hidden="true">+</div><div className="facility-info"><h4>{facility.name}</h4><p>{facility.address}, {facility.city}</p><span>Community submitted · Not independently verified</span></div><div className="facility-actions"><a className="status-button" href={`tel:${facility.phone}`}>Call</a><a className="status-button" href={`https://www.google.com/maps/search/${encodeURIComponent(`${facility.name} ${facility.address} ${facility.city}`)}`} target="_blank" rel="noreferrer">Directions ↗</a></div></article>) : <div className="empty-state"><h3>No saved facilities yet</h3><p>Search current nearby results in Maps or add a facility for this device.</p></div>}</div>
              <div className="safety-note"><strong>Urgent care comes first</strong><p>LifeLink is not monitored. Call your hospital blood bank or local emergency service directly for immediate medical needs.</p></div>
            </>}

            {view === 'inventory' && <>
              <div className="section-heading"><div><p className="eyebrow">STOCK CONTROL</p><h2>Blood inventory</h2><p className="section-copy">Maintain a local stock snapshot. This is not connected to a blood bank.</p></div><span className="local-data-badge">BROWSER STORAGE</span></div>
              <form className="form-panel management-form" onSubmit={updateStock}><h3>Update blood stock</h3><div className="inline-form-fields"><label className="field"><span>Blood group</span><select name="bloodGroup" required defaultValue=""><option value="" disabled>Select group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label><label className="field"><span>Current units</span><input name="units" type="number" min="0" max="10000" required placeholder="Enter current count" /></label><button type="submit" className="button button-red">Save stock</button></div></form>
              <div className="inventory-grid">{stock.map((item) => <article className={item.units < 4 ? 'inventory-card inventory-low' : 'inventory-card'} key={item.bloodGroup}><span className="blood-chip">{item.bloodGroup}</span><strong>{item.units}<small> units</small></strong><span className={item.units < 4 ? 'stock-status low-stock' : 'stock-status'}>{item.units < 4 ? 'Low stock' : 'Recorded'}</span><small>Updated {formatDate(item.updatedAt)}</small></article>)}</div><div className="safety-note"><strong>Stock data is illustrative</strong><p>Use a verified blood-bank inventory system for operational decisions. These numbers exist only in this browser.</p></div>
            </>}

            {view === 'donations' && <>
              <div className="section-heading"><div><p className="eyebrow">DONOR JOURNEY</p><h2>Donation history</h2><p className="section-copy">Record completed donations and view their local history.</p></div><span className="local-data-badge">LOCAL RECORDS</span></div>
              <form className="form-panel management-form" onSubmit={addDonation}><h3>Record a completed donation</h3><div className="form-grid"><label className="field"><span>Donor name</span><input name="donorName" required maxLength={70} placeholder="Donor name" /></label><label className="field"><span>Blood group</span><select name="bloodGroup" required defaultValue=""><option value="" disabled>Select group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label><label className="field"><span>Units</span><input name="units" type="number" min="1" max="5" defaultValue="1" required /></label><label className="field"><span>Donation date</span><input name="donatedAt" type="date" required defaultValue={todayDate} /></label></div><div className="form-foot"><p>Only record donations confirmed by the participating facility.</p><button className="button button-red" type="submit">Save donation</button></div></form>
              <div className="table-wrap"><table><thead><tr><th>Donor</th><th>Blood group</th><th>Units</th><th>Date</th><th>Status</th></tr></thead><tbody>{donations.map((donation) => <tr key={donation.id}><td>{donation.donorName}</td><td><span className="blood-chip">{donation.bloodGroup}</span></td><td>{donation.units}</td><td>{formatDate(donation.donatedAt)}</td><td><span className="table-status">{donation.status}</span></td></tr>)}</tbody></table>{donations.length === 0 && <div className="dashboard-empty">No donation records yet. Add a completed donation above.</div>}</div>
            </>}

            {view === 'camps' && <>
              <div className="section-heading"><div><p className="eyebrow">COMMUNITY EVENTS</p><h2>Blood donation camps</h2><p className="section-copy">Plan and track local community donation events.</p></div><span className="local-data-badge">LOCAL EVENT BOARD</span></div>
              <form className="form-panel management-form" onSubmit={addCamp}><h3>Create a blood camp listing</h3><div className="form-grid"><label className="field"><span>Camp name</span><input name="name" required maxLength={100} placeholder="Community donation day" /></label><label className="field"><span>City</span><input name="city" required maxLength={80} placeholder="City" /></label><label className="field"><span>Venue</span><input name="venue" required maxLength={150} placeholder="Facility and address" /></label><label className="field"><span>Event date</span><input name="date" type="date" required /></label><label className="field"><span>Donor capacity</span><input name="capacity" type="number" min="1" max="10000" defaultValue="50" required /></label><label className="field"><span>Organizer contact</span><input name="contact" type="tel" required maxLength={25} placeholder="Public event contact" /></label></div><div className="form-foot"><p>Confirm venue approval and staffing with the host facility.</p><button className="button button-red" type="submit">Add camp</button></div></form>
              <div className="camp-grid">{camps.map((camp) => <article className="camp-card" key={camp.id}><div className="camp-date"><strong>{camp.date.slice(8, 10)}</strong><span>{monthLabels[Number(camp.date.slice(5, 7)) - 1]}</span></div><div><h3>{camp.name}</h3><p>{camp.venue}, {camp.city}</p><small>Capacity {camp.capacity} · Organizer {camp.contact}</small></div><a href={`https://www.google.com/maps/search/${encodeURIComponent(`${camp.venue} ${camp.city}`)}`} target="_blank" rel="noreferrer">Directions ↗</a></article>)}</div>{camps.length === 0 && <div className="empty-state"><h3>No camps scheduled</h3><p>Save a community event using the form above.</p></div>}
            </>}

            {view === 'profile' && <>
              <div className="section-heading"><div><p className="eyebrow">YOUR PLACE IN THE NETWORK</p><h2>My donor profile</h2><p className="section-copy">Keep your profile current so your community knows when you can help.</p></div></div>
              {profile ? <div className="profile-card">
                <div className="profile-card-top"><div className="avatar large">{profile.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><h3>{profile.name}</h3><p>{profile.area}, {profile.city}</p></div><span className="blood-chip large-chip">{profile.bloodGroup}</span></div>
                <div className="availability-row"><div><strong>Donor availability</strong><p>{profile.available ? 'You are visible as available to the community.' : 'You are hidden from available donor searches.'}</p></div><button className={profile.available ? 'toggle on' : 'toggle'} role="switch" aria-checked={profile.available} aria-label="Toggle donor availability" onClick={changeAvailability}><span /></button></div>
                <div className="profile-contact"><span>Contact visibility</span><strong>{profile.sharePhone ? 'Shared with consent' : 'Private'}</strong><span>Last donation (self-reported)</span><strong>{profile.lastDonation}</strong><span>Profile status</span><strong>Donor self-reported · Not identity verified</strong></div>
                <button className="button button-outline" onClick={() => setView('register')}>Edit profile details</button>
              </div> : <div className="empty-state profile-empty"><span className="empty-mark">＋</span><h3>There’s room for you here</h3><p>Create a donor profile and let your community know when you’re available.</p><button className="button button-red" onClick={() => setView('register')}>Register as a donor <span>→</span></button></div>}
              <div className="safety-note"><strong>A note on privacy and eligibility</strong><p>This prototype uses your browser’s local storage. It does not publish information online or verify identities. Donor eligibility and blood compatibility must be confirmed by qualified healthcare staff.</p></div>
            </>}
          </section>
        </div>
      </main>
      <footer><span>LifeLink <span className="footer-separator">/</span> Blood donor finder</span><span>Community care, closer to home.</span></footer>
      <nav className="mobile-nav" aria-label="Main navigation">{(['dashboard', 'discover', 'requests', 'camps', 'profile'] as AppView[]).map((item) => <button key={item} className={view === item ? 'mobile-link active' : 'mobile-link'} onClick={() => setView(item)}>{item === 'dashboard' ? 'Overview' : item === 'discover' ? 'Donors' : item === 'requests' ? 'Requests' : item === 'camps' ? 'Camps' : 'Profile'}</button>)}</nav>
    </div>
  )
}

export default App
