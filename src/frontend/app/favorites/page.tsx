"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleNavigation } from "../components/role-navigation";
import { apiDelete, apiGet } from "../lib/api";
import { formatMoney, formatStatus, Property } from "../properties/types";

type Favorite = {
  id: number;
  propertyId: number;
  createdAt: string;
  property: Property;
};

type FavoritesResponse = { data: Favorite[] };

export default function SavedPropertiesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) {
      setError("Please sign in to see your saved properties.");
      setIsLoading(false);
      return;
    }

    apiGet<FavoritesResponse>("/favorites", { token })
      .then((response) => setFavorites(response.data))
      .catch((caughtError) =>
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load saved properties.")
      )
      .finally(() => setIsLoading(false));
  }, []);

  async function removeFavorite(propertyId: number) {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) return;

    setRemovingId(propertyId);
    setError("");
    try {
      await apiDelete(`/favorites/${propertyId}`, { token });
      setFavorites((current) => current.filter((favorite) => favorite.propertyId !== propertyId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to remove this property.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="catalogMockPage savedPage">
      <div className="catalogMockShell">
        <RoleNavigation />
        <header className="savedHeader">
          <div>
            <p className="pageEyebrow">YOUR WISHLIST</p>
            <h1>Saved properties</h1>
            <p>Keep your favorite homes together and return when you are ready.</p>
          </div>
          <span className="savedCount">{favorites.length} saved</span>
        </header>

        {error ? <p className="savedError">{error}</p> : null}

        <section className="savedGrid" aria-live="polite">
          {isLoading
            ? Array.from({ length: 3 }).map((_, index) => <div className="savedCard savedSkeleton" key={index} />)
            : null}
          {!isLoading && !error && favorites.length === 0 ? <EmptyWishlist /> : null}
          {!isLoading
            ? favorites.map((favorite, index) => (
                <article className="savedCard" key={favorite.id}>
                  <Link
                    aria-label={`View ${favorite.property.title}`}
                    className="savedCardLink"
                    href={`/properties/${favorite.property.id}`}
                  >
                    <PropertyImage property={favorite.property} gradientIndex={index} />
                  </Link>
                  <button
                    aria-label={`Remove ${favorite.property.title} from saved properties`}
                    className="savedHeart savedHeartActive"
                    disabled={removingId === favorite.propertyId}
                    onClick={() => removeFavorite(favorite.propertyId)}
                    type="button"
                  >
                    <span>♥</span>
                  </button>
                  <Link
                    aria-label={`View ${favorite.property.title}`}
                    className="savedCardBody savedCardLink"
                    href={`/properties/${favorite.property.id}`}
                  >
                    <div className="savedCardTopline">
                      <span>{favorite.property.type.toLowerCase()}</span>
                      <span className={`savedStatus status-${favorite.property.status}`}>
                        {formatStatus(favorite.property.status)}
                      </span>
                    </div>
                    <h2>{favorite.property.title}</h2>
                    <p className="savedPrice">{formatMoney(favorite.property.price)} / month</p>
                    <p className="savedLocation">{favorite.property.address}, {favorite.property.district}, {favorite.property.city}</p>
                    <div className="savedFacts">
                      <span>{Number(favorite.property.area).toLocaleString("vi-VN")} sqm</span>
                      {favorite.property.bedroom ? <span>{favorite.property.bedroom} bedrooms</span> : null}
                      {favorite.property.bathroom ? <span>{favorite.property.bathroom} bathrooms</span> : null}
                    </div>
                    <p className="savedOn">Saved {formatDate(favorite.createdAt)}</p>
                  </Link>
                </article>
              ))
            : null}
        </section>
      </div>
    </main>
  );
}

function EmptyWishlist() {
  return (
    <div className="savedEmpty">
      <span className="emptyHeart">♡</span>
      <h2>Your wishlist is waiting</h2>
      <p>Save homes you love from the catalogue to compare them here.</p>
      <Link className="savedBrowseButton" href="/properties">Browse properties</Link>
    </div>
  );
}

function PropertyImage({ property, gradientIndex }: { property: Property; gradientIndex: number }) {
  const image = property.images[0];
  return (
    <div className={`savedImage savedGradient-${(gradientIndex % 4) + 1}`}>
      {image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={image.alt ?? property.title} onError={(event) => { event.currentTarget.style.display = "none"; }} src={image.url} />
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
