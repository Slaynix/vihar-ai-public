import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { supabase } from "@/integrations/supabase/client";
import { searchInternshipListings, type InternshipListing } from "@/lib/resources.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowUpRight, Bookmark, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, LoaderCircle, Search, Share2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/internships")({
  head: () => ({ meta: [
    { title: "VIHAR // Internship Finder" },
    { name: "description", content: "Find relevant internships and track every application in one place." },
    { property: "og:title", content: "VIHAR Internship Finder" },
    { property: "og:description", content: "Build your profile, discover live internship listings, and track applications." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InternshipsPage,
});

type Skill = { name: string; confidence: "Beginner" | "Intermediate" | "Advanced" };
type Profile = {
  name: string; college: string; degree: string; branch: string; year: string; semester: string; graduationYear: string;
  skills: Skill[]; employment: "part-time" | "full-time" | "either"; availability: string; roles: string[]; otherRole: string;
  workMode: "remote" | "hybrid" | "on-site" | "any"; country: string; state: string; city: string; radius: string;
  anywhereIndia: boolean; international: boolean; minDuration: string; maxDuration: string; pay: "paid" | "unpaid" | "either";
  minStipend: string; startDate: string; immediate: boolean; companySize: string; industry: string;
};
type Application = {
  id: string; title: string; company: string; url: string; location: string | null; work_mode: string | null;
  employment_type: string | null; stipend: string | null; source: string | null; description: string | null;
  status: string; notes: string | null; posted_at: string | null;
};

const emptyProfile: Profile = {
  name: "", college: "", degree: "", branch: "", year: "", semester: "", graduationYear: "",
  skills: [], employment: "either", availability: "Flexible", roles: [], otherRole: "", workMode: "any",
  country: "India", state: "", city: "", radius: "50", anywhereIndia: false, international: false,
  minDuration: "1", maxDuration: "6", pay: "either", minStipend: "", startDate: "", immediate: false,
  companySize: "Any", industry: "",
};
const wizardSteps = ["Details", "Skills", "Type", "Role", "Location", "Preferences"];
const roleOptions = ["Software Development", "Web Development", "Data Science", "Machine Learning", "Cybersecurity", "UI/UX Design", "Product Management", "Electronics", "Research"];
const skillOptions = ["JavaScript", "Python", "Java", "React", "SQL", "Machine Learning", "Data Structures", "Figma", "C++"];
const statuses = ["saved", "applied", "assessment", "interview", "selected", "rejected"];
const statusLabels: Record<string, string> = { saved: "Saved", applied: "Applied", assessment: "Assessment", interview: "Interview", selected: "Selected", rejected: "Rejected" };

function InternshipsPage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [step, setStep] = useState(0);
  const [profileReady, setProfileReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<InternshipListing[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filterText, setFilterText] = useState("");
  const [sort, setSort] = useState("match");
  const [tab, setTab] = useState<"discover" | "tracker">("discover");
  const searchFn = useServerFn(searchInternshipListings);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setLoading(false); return; }
      const [preferences, saved] = await Promise.all([
        supabase.from("user_preferences").select("prefs").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("internship_applications").select("id,title,company,url,location,work_mode,employment_type,stipend,source,description,status,notes,posted_at").order("updated_at", { ascending: false }),
      ]);
      if (!active) return;
      if (preferences.error) toast.error("Your internship profile could not be loaded.");
      const prefs = preferences.data?.prefs as Record<string, unknown> | null;
      const savedProfile = prefs?.internshipProfile;
      if (savedProfile && typeof savedProfile === "object") {
        setProfile({ ...emptyProfile, ...(savedProfile as Partial<Profile>) });
        setProfileReady(true);
      }
      if (saved.error) toast.error("Your application tracker could not be loaded.");
      setApplications((saved.data ?? []) as Application[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const roleList = useMemo(() => [...profile.roles, ...(profile.otherRole.trim() ? [profile.otherRole.trim()] : [])], [profile.roles, profile.otherRole]);
  const visibleResults = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    const filtered = results.filter((item) => !needle || `${item.title} ${item.company} ${item.location} ${item.description} ${item.source}`.toLowerCase().includes(needle));
    if (sort === "company") return [...filtered].sort((a, b) => a.company.localeCompare(b.company));
    if (sort === "title") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [filterText, results, sort]);
  const counts = useMemo(() => statuses.reduce<Record<string, number>>((out, status) => {
    out[status] = applications.filter((item) => item.status === status).length;
    return out;
  }, {}), [applications]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function toggleChoice(key: "roles", value: string) {
    update(key, profile[key].includes(value) ? profile[key].filter((item) => item !== value) : [...profile[key], value]);
  }

  function toggleSkill(name: string) {
    const exists = profile.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase());
    update("skills", exists ? profile.skills.filter((skill) => skill.name.toLowerCase() !== name.toLowerCase()) : [...profile.skills, { name, confidence: "Intermediate" }]);
  }

  async function saveProfile() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Sign in to save your internship profile."); return false; }
    setSavingProfile(true);
    const { data: existing } = await supabase.from("user_preferences").select("prefs").eq("user_id", auth.user.id).maybeSingle();
    const prefs = { ...((existing?.prefs as Record<string, unknown> | null) ?? {}), internshipProfile: profile };
    const { error } = await supabase.from("user_preferences").upsert({ user_id: auth.user.id, prefs: prefs as never }, { onConflict: "user_id" });
    setSavingProfile(false);
    if (error) { toast.error("Your profile could not be saved. Please try again."); return false; }
    setProfileReady(true);
    toast.success("Internship profile saved.");
    return true;
  }

  async function searchListings() {
    if (!roleList.length && !profile.skills.length) { toast.error("Choose a role or add a skill before searching."); setStep(1); return; }
    setSearching(true);
    setResults([]);
    try {
      const location = profile.anywhereIndia ? "India" : profile.international ? (profile.country || "International") : [profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "India";
      const listings = await searchFn({ data: {
        roles: roleList,
        skills: profile.skills.map((skill) => skill.name),
        location,
        workMode: profile.workMode,
        employment: profile.employment,
        domain: profile.industry,
      } });
      setResults(listings);
      setTab("discover");
      if (!listings.length) toast.message("No live listings matched this search. Try a broader role or location.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Internship search is temporarily unavailable.");
    } finally { setSearching(false); }
  }

  async function saveListing(listing: InternshipListing) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Sign in to save internships."); return; }
    const existing = applications.find((item) => item.url === listing.url);
    if (existing) { toast.message("This listing is already in your tracker."); return; }
    const item: Application = {
      id: crypto.randomUUID(), title: listing.title, company: listing.company, url: listing.url,
      location: listing.location, work_mode: profile.workMode === "any" ? null : profile.workMode,
      employment_type: profile.employment === "either" ? null : profile.employment,
      stipend: null, source: listing.source, description: listing.description, status: "saved", notes: null, posted_at: null,
    };
    setApplications((current) => [item, ...current]);
    const { error } = await supabase.from("internship_applications").insert({
      user_id: auth.user.id, title: item.title, company: item.company, url: item.url,
      location: item.location, work_mode: item.work_mode, employment_type: item.employment_type,
      source: item.source, description: item.description, status: "saved",
    });
    if (error) { setApplications((current) => current.filter((app) => app.id !== item.id)); toast.error("Could not save this listing."); }
    else toast.success("Saved to your application tracker.");
  }

  async function updateApplication(id: string, changes: Partial<Pick<Application, "status" | "notes">>) {
    const before = applications;
    setApplications((current) => current.map((app) => app.id === id ? { ...app, ...changes } : app));
    const { error } = await supabase.from("internship_applications").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setApplications(before); toast.error("That tracker update could not be saved."); }
  }

  async function removeApplication(id: string) {
    const before = applications;
    setApplications((current) => current.filter((app) => app.id !== id));
    const { error } = await supabase.from("internship_applications").delete().eq("id", id);
    if (error) { setApplications(before); toast.error("Could not remove that application."); }
  }

  async function shareListing(listing: Pick<InternshipListing, "title" | "url">) {
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url: listing.url });
      else { await navigator.clipboard.writeText(listing.url); toast.success("Listing link copied."); }
    } catch { /* Share dialog dismissed. */ }
  }

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><HudLabel>VIHAR // CAREER DISCOVERY</HudLabel><h1 className="mt-1 text-2xl text-glow-cyan">Find your next internship.</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">A profile-led search for live listings, with every saved opportunity in one tracker.</p></div>
        <div className="flex gap-2"><HoloButton variant={tab === "discover" ? "primary" : "ghost"} onClick={() => setTab("discover")}><Search className="h-4 w-4" />Discover</HoloButton><HoloButton variant={tab === "tracker" ? "primary" : "ghost"} onClick={() => setTab("tracker")}><Bookmark className="h-4 w-4" />Tracker <span className="rounded-full bg-background/30 px-1.5 text-xs">{applications.length}</span></HoloButton></div>
      </div>

      {tab === "discover" ? <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(310px,.8fr)_minmax(0,1.4fr)]">
        <section className="min-w-0 space-y-4" aria-label="Internship profile">
          <HoloPanel glow="none">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg">Your search profile</h2><p className="mt-1 text-xs text-muted-foreground">Saved privately to your account.</p></div><span className="text-xs text-muted-foreground">{step + 1} / 6</span></div>
            <div className="mb-5 flex gap-1" aria-label="Profile steps">{wizardSteps.map((label, index) => <button key={label} type="button" aria-label={`Step ${index + 1}: ${label}`} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)} className={cn("h-1.5 flex-1 rounded-full transition-colors", index <= step ? "bg-primary" : "bg-muted")} />)}</div>
            <div className="mb-4 flex flex-wrap gap-1.5">{wizardSteps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} className={cn("min-h-9 rounded-md border px-2.5 text-xs transition-colors", index === step ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{index + 1}. {label}</button>)}</div>
            <div className="space-y-3">
              {step === 0 && <>
                <StepTitle title="Tell us about your studies" detail="This helps you focus on roles relevant to your stage." />
                <Field label="Name" value={profile.name} onChange={(v) => update("name", v)} placeholder="Your name" />
                <Field label="College / university" value={profile.college} onChange={(v) => update("college", v)} placeholder="College name" />
                <div className="grid grid-cols-2 gap-2"><Field label="Degree" value={profile.degree} onChange={(v) => update("degree", v)} placeholder="B.Tech" /><Field label="Branch" value={profile.branch} onChange={(v) => update("branch", v)} placeholder="Computer science" /></div>
                <div className="grid grid-cols-3 gap-2"><SelectField label="Year" value={profile.year} onChange={(v) => update("year", v)} options={["1st year", "2nd year", "3rd year", "4th year", "Graduate"]} /><Field label="Semester" value={profile.semester} onChange={(v) => update("semester", v)} placeholder="6" /><Field label="Graduation" value={profile.graduationYear} onChange={(v) => update("graduationYear", v)} placeholder="2027" /></div>
              </>}
              {step === 1 && <>
                <StepTitle title="Skills and confidence" detail="Pick what you can use today; add skills not listed." />
                <div className="flex flex-wrap gap-2">{skillOptions.map((skill) => <Choice key={skill} active={profile.skills.some((item) => item.name === skill)} onClick={() => toggleSkill(skill)}>{skill}</Choice>)}</div>
                <SkillAdder skills={profile.skills} onChange={(skills) => update("skills", skills)} />
                {profile.skills.map((skill) => <label key={skill.name} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm"><span className="min-w-0 truncate">{skill.name}</span><select aria-label={`${skill.name} confidence`} value={skill.confidence} onChange={(event) => update("skills", profile.skills.map((item) => item.name === skill.name ? { ...item, confidence: event.target.value as Skill["confidence"] } : item))} className="min-h-10 max-w-40 rounded-md border border-input bg-background px-2 text-xs">{["Beginner", "Intermediate", "Advanced"].map((level) => <option key={level}>{level}</option>)}</select></label>)}
              </>}
              {step === 2 && <>
                <StepTitle title="Work type and availability" detail="Set the commitment that fits around your studies." />
                <ChoiceGroup label="Employment type" value={profile.employment} options={[["part-time", "Part-time"], ["full-time", "Full-time"], ["either", "Either"]]} onChange={(v) => update("employment", v as Profile["employment"])} />
                <ChoiceGroup label="Availability" value={profile.availability} options={[["Weekdays", "Weekdays"], ["Weekends", "Weekends"], ["Flexible", "Flexible"]]} onChange={(v) => update("availability", v)} />
                <p className="text-xs text-muted-foreground">Availability: {profile.availability}{profile.availability === "Flexible" ? "" : "; listings are searched using your selected work type."}</p>
              </>}
              {step === 3 && <>
                <StepTitle title="Choose roles to explore" detail="Select multiple areas, then add a specific role if needed." />
                <div className="flex flex-wrap gap-2">{roleOptions.map((role) => <Choice key={role} active={profile.roles.includes(role)} onClick={() => toggleChoice("roles", role)}>{role}</Choice>)}</div>
                <Field label="Other role" value={profile.otherRole} onChange={(v) => update("otherRole", v)} placeholder="e.g. Robotics intern" />
              </>}
              {step === 4 && <>
                <StepTitle title="Where would you like to work?" detail="Location details are used to shape live listing searches." />
                <ChoiceGroup label="Work mode" value={profile.workMode} options={[["remote", "Remote"], ["hybrid", "Hybrid"], ["on-site", "On-site"], ["any", "Any"]]} onChange={(v) => update("workMode", v as Profile["workMode"])} />
                <div className="grid grid-cols-2 gap-2"><Field label="Country" value={profile.country} onChange={(v) => update("country", v)} placeholder="India" /><Field label="State" value={profile.state} onChange={(v) => update("state", v)} placeholder="Karnataka" /><Field label="City" value={profile.city} onChange={(v) => update("city", v)} placeholder="Bengaluru" /><SelectField label="Radius" value={profile.radius} onChange={(v) => update("radius", v)} options={["10", "25", "50", "100", "Any"]} suffix="km" /></div>
                <CheckLine checked={profile.anywhereIndia} onChange={(v) => update("anywhereIndia", v)} label="Anywhere in India" /><CheckLine checked={profile.international} onChange={(v) => update("international", v)} label="Include international listings" />
              </>}
              {step === 5 && <>
                <StepTitle title="Set your preferences" detail="Optional filters help narrow down what you see." />
                <div className="grid grid-cols-2 gap-2"><Field label="Minimum duration (months)" value={profile.minDuration} onChange={(v) => update("minDuration", v)} placeholder="1" type="number" /><Field label="Maximum duration (months)" value={profile.maxDuration} onChange={(v) => update("maxDuration", v)} placeholder="6" type="number" /></div>
                <ChoiceGroup label="Compensation" value={profile.pay} options={[["paid", "Paid"], ["unpaid", "Unpaid"], ["either", "Either"]]} onChange={(v) => update("pay", v as Profile["pay"])} />
                <div className="grid grid-cols-2 gap-2"><Field label="Minimum stipend" value={profile.minStipend} onChange={(v) => update("minStipend", v)} placeholder="Optional" /><Field label="Preferred start date" value={profile.startDate} onChange={(v) => update("startDate", v)} type="date" /></div>
                <CheckLine checked={profile.immediate} onChange={(v) => update("immediate", v)} label="Available to join immediately" />
                <SelectField label="Company size" value={profile.companySize} onChange={(v) => update("companySize", v)} options={["Any", "Startup", "Small", "Medium", "Large"]} />
                <Field label="Industry" value={profile.industry} onChange={(v) => update("industry", v)} placeholder="e.g. Climate tech" />
              </>}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4"><HoloButton variant="ghost" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ChevronLeft className="h-4 w-4" />Back</HoloButton>{step < 5 ? <HoloButton onClick={() => setStep((current) => Math.min(5, current + 1))}>Next<ChevronRight className="h-4 w-4" /></HoloButton> : <HoloButton onClick={saveProfile} disabled={savingProfile}>{savingProfile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{profileReady ? "Save changes" : "Save profile"}</HoloButton>}</div>
          </HoloPanel>
          <HoloButton onClick={searchListings} disabled={searching || loading} className="min-h-12 w-full text-base">{searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{searching ? "Finding live listings…" : "Find internships"}<ArrowUpRight className="h-4 w-4" /></HoloButton>
        </section>

        <section className="min-w-0 space-y-4" aria-label="Internship listings">
          <HoloPanel glow="none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><HudLabel>LIVE DISCOVERY</HudLabel><h2 className="mt-1 text-xl">Opportunities for you</h2><p className="mt-1 text-sm text-muted-foreground">{results.length ? `${results.length} listings found from live web search.` : "Search to see current listings and their original sources."}</p></div><div className="grid grid-cols-2 gap-2"><Field label="Filter listings" value={filterText} onChange={setFilterText} placeholder="Role, company, skill" /><SelectField label="Sort" value={sort} onChange={setSort} options={["match", "company", "title"]} labels={["Search order", "Company A–Z", "Title A–Z"]} /></div></div>
          </HoloPanel>
          {searching ? <HoloPanel glow="none"><div className="space-y-3" aria-label="Searching listings">{[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-md bg-muted" />)}</div></HoloPanel> : visibleResults.length ? <div className="space-y-3">{visibleResults.map((listing) => <ListingCard key={listing.url} listing={listing} saved={applications.some((app) => app.url === listing.url)} onSave={() => saveListing(listing)} onShare={() => shareListing(listing)} />)}</div> : <HoloPanel glow="none"><div className="py-10 text-center"><Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-medium">{results.length ? "No listings match that filter" : "Your next opportunity starts here"}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{results.length ? "Clear the filter or try a different keyword." : "Choose a role or skill, then search for live listings from around the web."}</p>{results.length > 0 && <HoloButton variant="ghost" className="mt-4" onClick={() => setFilterText("")}>Clear filter</HoloButton>}</div></HoloPanel>}
        </section>
      </div> : <section className="space-y-5" aria-label="Application tracker">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{statuses.map((status) => <HoloPanel key={status} glow="none" className="p-3"><p className="text-xs text-muted-foreground">{statusLabels[status]}</p><p className="mt-1 text-2xl font-semibold">{counts[status] ?? 0}</p></HoloPanel>)}</div>
        {loading ? <HoloPanel glow="none"><div className="h-32 animate-pulse rounded-md bg-muted" /></HoloPanel> : applications.length ? <div className="grid gap-3 lg:grid-cols-2">{applications.map((application) => <ApplicationCard key={application.id} application={application} onStatus={(status) => updateApplication(application.id, { status })} onNotes={(notes) => updateApplication(application.id, { notes })} onRemove={() => removeApplication(application.id)} onShare={() => shareListing(application)} />)}</div> : <HoloPanel glow="none"><div className="py-12 text-center"><Bookmark className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="text-lg">No saved listings yet</h2><p className="mt-2 text-sm text-muted-foreground">Save an opportunity from Discover to start tracking it here.</p><HoloButton className="mt-4" onClick={() => setTab("discover")}><Search className="h-4 w-4" />Discover internships</HoloButton></div></HoloPanel>}
      </section>}
    </DashboardShell>
  );
}

function StepTitle({ title, detail }: { title: string; detail: string }) { return <div className="mb-4"><h3 className="font-medium">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p></div>; }
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block min-w-0 text-xs text-muted-foreground">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70" /></label>;
}
function SelectField({ label, value, onChange, options, labels, suffix }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: string[]; suffix?: string }) {
  return <label className="block min-w-0 text-xs text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground">{options.map((option, index) => <option key={option} value={option}>{labels?.[index] ?? `${option}${suffix ? ` ${suffix}` : ""}`}</option>)}</select></label>;
}
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("min-h-10 rounded-md border px-3 text-xs transition-colors", active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}>{children}</button>;
}
function ChoiceGroup({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <fieldset><legend className="mb-2 text-xs text-muted-foreground">{label}</legend><div className="flex flex-wrap gap-2">{options.map(([option, labelText]) => <Choice key={option} active={value === option} onClick={() => onChange(option)}>{labelText}</Choice>)}</div></fieldset>;
}
function CheckLine({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-primary" />{label}</label>;
}
function SkillAdder({ skills, onChange }: { skills: Skill[]; onChange: (skills: Skill[]) => void }) {
  const [value, setValue] = useState("");
  function add() { const name = value.trim(); if (name && !skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) onChange([...skills, { name, confidence: "Intermediate" }]); setValue(""); }
  return <div className="flex gap-2"><input aria-label="Add another skill" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="Add another skill" className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" /><HoloButton variant="ghost" onClick={add} disabled={!value.trim()}>Add</HoloButton></div>;
}
function ListingCard({ listing, saved, onSave, onShare }: { listing: InternshipListing; saved: boolean; onSave: () => void; onShare: () => void }) {
  return <HoloPanel glow="none" className="transition-colors hover:border-primary/50"><div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border bg-muted text-sm font-semibold text-primary">{listing.company.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><h3 className="break-words font-medium">{listing.title}</h3><p className="mt-1 text-sm text-muted-foreground">{listing.company} <span aria-hidden="true">·</span> {listing.location}</p></div></div><p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{listing.description || "The source listing contains no description."}</p><p className="mt-3 text-xs text-muted-foreground">Source: {listing.source}</p></div><div className="flex shrink-0 flex-wrap gap-2 sm:flex-col"><a href={listing.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Open listing<ExternalLink className="h-4 w-4" /></a><HoloButton variant="ghost" onClick={onSave} disabled={saved}>{saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{saved ? "Saved" : "Save"}</HoloButton><HoloButton variant="ghost" onClick={onShare} aria-label={`Share ${listing.title}`}><Share2 className="h-4 w-4" /><span className="sm:hidden">Share</span></HoloButton></div></div></HoloPanel>;
}
function ApplicationCard({ application, onStatus, onNotes, onRemove, onShare }: { application: Application; onStatus: (value: string) => void; onNotes: (value: string) => void; onRemove: () => void; onShare: () => void }) {
  return <HoloPanel glow="none"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-medium">{application.title}</h3><p className="mt-1 text-sm text-muted-foreground">{application.company}{application.location ? ` · ${application.location}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{application.source ? `Source: ${application.source}` : "Source details unavailable"}</p></div><a href={application.url} target="_blank" rel="noreferrer" aria-label={`Open listing for ${application.title}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-xs text-muted-foreground">Application status<select value={application.status} onChange={(event) => onStatus(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><div className="flex items-end gap-2"><HoloButton variant="ghost" onClick={onShare} aria-label={`Share ${application.title}`}><Share2 className="h-4 w-4" /><span className="sm:hidden">Share</span></HoloButton><HoloButton variant="ghost" onClick={onRemove} aria-label={`Remove ${application.title}`}><Trash2 className="h-4 w-4" /><span className="sm:hidden">Remove</span></HoloButton></div></div><label className="mt-3 block text-xs text-muted-foreground">Notes<textarea value={application.notes ?? ""} onChange={(event) => onNotes(event.target.value)} onBlur={(event) => onNotes(event.target.value)} placeholder="Add a note about your next step" rows={2} className="mt-1 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" /></label></HoloPanel>;
}