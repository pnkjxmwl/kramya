"use client";
import { useState } from "react";
import { Mark } from "../components/mark";
import { Icon } from "../components/icon";
const views = [
  ["reception", "Reception"],
  ["doctor", "Doctor"],
  ["patient", "Patient"],
] as const;
type View = (typeof views)[number][0];
/** Public fictional illustration; never used for authenticated clinic data. */
export function ProductPreview() {
  const [view, setView] = useState<View>("reception");
  return (
    <div className="product-showcase">
      <div className="product-preview-toolbar">
        <div role="tablist" aria-label="Explore product views">
          {views.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              tabIndex={view === id ? 0 : -1}
              onKeyDown={(event) => {
                const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const i = views.findIndex(([key]) => key === view);
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? views.length - 1
                      : (i +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          views.length) %
                        views.length;
                setView(views[next]![0]);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>("button")
                  [next]?.focus();
              }}
              id={`preview-tab-${id}`}
              aria-controls="product-preview-panel"
              aria-selected={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <span>
          <span className="marketing-dot" /> Illustrative example
        </span>
      </div>
      <div
        id="product-preview-panel"
        role="tabpanel"
        aria-labelledby={`preview-tab-${view}`}
        className={`product-preview-panel ${view}`}
      >
        {view === "patient" ? (
          <PatientPreview />
        ) : (
          <>
            <aside className="product-preview-rail">
              <div className="marketing-brand">
                <Mark />
                <span>Kramya</span>
              </div>
              <div className="product-clinic-label">
                <span>SC</span>
                <div>
                  <b>Sample Clinic</b>
                  <small>
                    {view === "doctor"
                      ? "Doctor workspace"
                      : "Reception workspace"}
                  </small>
                </div>
              </div>
              <div className="product-preview-nav">
                <span>
                  <Icon name="overview" /> Overview
                </span>
                <span className="selected">
                  <Icon name="queue" /> Queue
                </span>
                <span>
                  <Icon name="config" /> Configuration
                </span>
              </div>
              <small>Fictional clinic data</small>
            </aside>
            <div className="product-preview-main">
              <header>
                <span>
                  Sample Clinic /{" "}
                  {view === "doctor" ? "Consultation" : "Queue desk"}
                </span>
                <span>Thu, 12 Nov · 11:24</span>
              </header>
              <div className="product-preview-title">
                <div>
                  <small>TODAY’S SESSION</small>
                  <h3>
                    {view === "doctor"
                      ? "Dr. Anjali Sharma"
                      : "The clinic, at a glance."}
                  </h3>
                </div>
                <span className="product-status">
                  <span className="marketing-dot" /> Session active
                </span>
              </div>
              {view === "doctor" ? <DoctorPreview /> : <ReceptionPreview />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function ReceptionPreview() {
  return (
    <>
      <div className="product-stats">
        {[
          ["5", "Checked in"],
          ["5", "Booked, not here"],
          ["14", "Seen today"],
        ].map(([v, l]) => (
          <div key={l}>
            <strong>{v}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <div className="product-session-list">
        <div className="product-list-head">
          <span>DOCTOR / SESSION</span>
          <span>NOW SERVING</span>
          <span>CHECKED IN</span>
        </div>
        {[
          ["AS", "Dr. Anjali Sharma", "Cardiology · 09:00–13:00", "A021", "3"],
          [
            "MD",
            "Dr. Meera Desai",
            "General medicine · 10:00–14:00",
            "B014",
            "2",
          ],
          ["NS", "Dr. Neha Shah", "Dental care · 12:00–15:00", "—", "0"],
        ].map(([initials, name, specialty, token, count]) => (
          <div className="product-session-row" key={name}>
            <div>
              <span className="marketing-initials">{initials}</span>
              <span>
                <b>{name}</b>
                <small>{specialty}</small>
              </span>
            </div>
            <span className="product-token-chip">{token}</span>
            <span>
              {count}
              <Icon name="chevron-right" />
            </span>
          </div>
        ))}
      </div>
      <div className="product-preview-bottom">
        <span>
          <Icon name="check-circle" /> Arrival and booking stay separate.
        </span>
        <span>
          View session <Icon name="arrow-right" />
        </span>
      </div>
    </>
  );
}
function DoctorPreview() {
  return (
    <>
      <div className="product-doctor-stage">
        <div className="product-dark-ticket">
          <small>IN CONSULTATION</small>
          <strong>A021</strong>
          <span>Current patient</span>
        </div>
        <div className="product-doctor-patient">
          <span className="marketing-initials apricot">AS</span>
          <h4>Anita Shah</h4>
          <p>Checked in · Online booking</p>
          <span className="product-status">In consultation</span>
        </div>
        <div className="product-doctor-actions">
          <span>
            Complete consultation <Icon name="check" />
          </span>
          <div>
            <span>Call next</span>
            <span>Skip</span>
            <span>No-show</span>
            <span>Pause queue</span>
          </div>
          <small>Preview labels · no patient actions</small>
        </div>
      </div>
      <div className="product-up-next">
        <small>UP NEXT · CHECKED IN</small>
        <p>
          <span className="product-token-chip">A022</span>
          <b>Rahul Mehta</b>
          <span>Ready when called</span>
        </p>
        <p>
          <span className="product-token-chip">A024</span>
          <b>Meera Kapoor</b>
          <span>Checked in</span>
        </p>
      </div>
    </>
  );
}
function PatientPreview() {
  return (
    <div className="product-patient-scene">
      <div className="product-patient-copy">
        <span className="marketing-eyebrow">KRAMYA FOR ANDROID</span>
        <h3>
          A token to keep.
          <br />A turn to follow.
        </h3>
        <p>
          Know which patient is booked, see the latest queue status and keep the
          check-in QR ready.
        </p>
        <span>Native Android · clinic pilots in preparation</span>
      </div>
      <div className="product-phone">
        <div className="product-phone-bar">
          <span>11:24</span>
          <Icon name="wifi" />
        </div>
        <div className="product-phone-heading">
          <Icon name="arrow-left" />
          <b>Your live token</b>
          <Icon name="refresh-cw" />
        </div>
        <span className="product-status">Booking confirmed</span>
        <div className="product-dark-ticket">
          <small>YOUR TOKEN</small>
          <strong>A024</strong>
          <p>Meera Kapoor</p>
          <span>
            ESTIMATED TURN<b>11:40–12:00</b>
            <small>Your turn can move.</small>
          </span>
        </div>
        <div className="product-phone-counts">
          <span>
            <b>3</b>checked in ahead
          </span>
          <span>
            <b>5</b>booked ahead
          </span>
        </div>
        <p className="product-phone-note">
          Show your signed check-in QR at reception.
        </p>
        <div className="product-phone-gesture" />
      </div>
    </div>
  );
}
