"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RoleNavigation } from "../../components/role-navigation";
import { apiDelete, apiGet, apiPost } from "../../lib/api";
import { formatMoney, formatStatus, Property } from "../types";
import { Toast } from "../../components/toast";

type AuthRole = "ADMIN" | "CUSTOMER" | "SALES_AGENT" | null;
type FavoritesResponse = { data: Array<{ propertyId: number }> };

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [role, setRole] = useState<AuthRole>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingEditAccess, setIsCheckingEditAccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    apiGet<Property>(`/properties/${params.id}`)
      .then((response) => setProperty(response))
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Unable to load this property."))
      .finally(() => setIsLoading(false));

    const token = localStorage.getItem("selapAccessToken");
    setRole(getRoleFromToken(token));
    if (token) {
      apiGet<FavoritesResponse>("/favorites", { token })
        .then((response) => setIsSaved(response.data.some((favorite) => favorite.propertyId === Number(params.id))))
        .catch(() => undefined);
    }
  }, [params.id]);

  async function requestConsultation() {
    const token = localStorage.getItem("selapAccessToken");
    if (!token || !property) {
      router.push("/auth/login");
      return;
    }

    setIsRequesting(true);
    setError("");

    try {
      await apiPost("/leads", {
        token,
        body: {
          propertyId: property.id,
          note: "Customer requested consultation from detail page.",
        },
      });

      setRequestSuccess(true);

      // Gọi Toast thông báo thành công
      setToast({
        message: "Consultation request sent! A Sales Agent will contact you soon.",
        type: "success",
      });
    } catch (caughtError) {
      // Gọi Toast thông báo thất bại
      setToast({
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to send consultation request.",
        type: "error",
      });
    } finally {
      setIsRequesting(false);
    }
  }

  async function toggleSave() {
    if (isSaving) return;
    const token = localStorage.getItem("selapAccessToken");
    if (!token || !property) {
      router.push("/auth/login");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      if (isSaved) {
        await apiDelete(`/favorites/${property.id}`, { token });
        setIsSaved(false);
      } else {
        await apiPost(`/favorites/${property.id}`, { token });
        setIsSaved(true);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update favorites.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProperty() {
    const token = localStorage.getItem("selapAccessToken");
    if (!token || !property) return;
    if (!window.confirm(`Delete "${property.title}"? This action cannot be undone.`)) return;
    setIsDeleting(true);
    setError("");
    try {
      await apiDelete(`/properties/${property.id}`, { token });
      router.push("/properties");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete property.");
      setIsDeleting(false);
    }
  }

  async function editProperty() {
    const token = localStorage.getItem("selapAccessToken");

    if (!token || !property) {
      router.push("/auth/login");
      return;
    }

    setIsCheckingEditAccess(true);
    setError("");

    try {
      await apiGet(`/properties/manage/${property.id}`, { token });
      router.push(`/properties/manage?edit=${property.id}&returnTo=${encodeURIComponent(`/properties/${property.id}`)}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "You can only edit properties in your assigned regions."
      );
      setIsCheckingEditAccess(false);
    }
  }

  const images = property?.images ?? [];
  const image = images[activeImage] ?? images[0];
  const canManage = role === "ADMIN" || role === "SALES_AGENT";

  return (
    <main className="catalogMockPage detailPage">
      <div className="catalogMockShell">
        <RoleNavigation />
        <Link className="detailBack" href="/properties">← Back to catalogue</Link>
        {isLoading ? <div className="detailLoading">Loading property…</div> : null}
        {error && !property ? <p className="savedError">{error}</p> : null}
        {property ? (
          <section className="detailLayout">
            <div className="detailGallery">
              <div className="detailMainImage">
                {image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={image.alt ?? property.title} src={image.url} />
                ) : <div className="detailFallbackImage" />}
                {images.length > 1 ? (
                  <>
                    <button aria-label="Previous image" className="galleryArrow previous" onClick={() => setActiveImage((current) => (current - 1 + images.length) % images.length)} type="button">‹</button>
                    <button aria-label="Next image" className="galleryArrow next" onClick={() => setActiveImage((current) => (current + 1) % images.length)} type="button">›</button>
                  </>
                ) : null}
              </div>
              {images.length > 1 ? <div className="detailThumbnails">{images.map((item, index) => (
                <button aria-label={`View image ${index + 1}`} className={activeImage === index ? "thumbnail active" : "thumbnail"} key={item.id ?? item.url} onClick={() => setActiveImage(index)} type="button">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src={item.url} />
                </button>
              ))}</div> : null}
            </div>
            <aside className="detailSummary">
              <div className="detailTitleRow"><span className={`detailStatus status-${property.status}`}>{formatStatus(property.status)}</span><span>{property.type}</span></div>
              <h1>{property.title}</h1>
              <p className="detailPrice">{formatMoney(property.price)}</p>
              <p className="detailLocation">{property.address}, {property.district}, {property.city}</p>
              <dl className="detailQuickFacts">
                <div><dt>Area</dt><dd>{Number(property.area).toLocaleString("vi-VN")} sqm</dd></div>
                <div><dt>Bedrooms</dt><dd>{property.bedroom ?? "—"}</dd></div>
                <div><dt>Bathrooms</dt><dd>{property.bathroom ?? "—"}</dd></div>
              </dl>
              <div className="detailDescription"><h2>Highlights</h2><p>{property.description || "A well-presented property with convenient access to the surrounding area."}</p></div>
              {error ? <p className="detailError">{error}</p> : null}
              {canManage ? (
                <div className="detailActions">
                  <button className="detailEditButton" disabled={isCheckingEditAccess} onClick={editProperty} type="button">{isCheckingEditAccess ? "Checking..." : "Edit"}</button>
                  <button className="detailDeleteButton" disabled={isDeleting} onClick={deleteProperty} type="button">{isDeleting ? "Deleting…" : "Delete"}</button>
                </div>
              ) : (
                <div className="detailActions">
                  <button className="detailEditButton" disabled={isRequesting || requestSuccess} onClick={requestConsultation} type="button" style={{backgroundColor: requestSuccess ? "#94a3b8" : undefined, borderColor: requestSuccess ? "#94a3b8" : undefined, color: requestSuccess ? "#ffffff" : undefined, cursor: requestSuccess ? "not-allowed" : "pointer",}}> {isRequesting ? "Sending..." : requestSuccess ? "Request Pending" : "Request consultation"} </button>
                  <button className="detailSaveButton" disabled={isSaving} onClick={toggleSave} type="button">{isSaving ? "Saving..." : isSaved ? "Move To Favorites" : "Save to Favorites"}</button>
                </div>
              )}
            </aside>
          </section>
        ) : null}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </main>
  );
}

function getRoleFromToken(token: string | null): AuthRole {
  if (!token) return null;
  try {
    const value = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(value.padEnd(Math.ceil(value.length / 4) * 4, "="))) as { role?: AuthRole };
    return payload.role ?? null;
  } catch {
    return null;
  }
}
