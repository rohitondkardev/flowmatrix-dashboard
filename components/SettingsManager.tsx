"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Preferences = {
  emailNotifications: boolean;
  approvalNotifications: boolean;
  projectNotifications: boolean;
  dateFormat: string;
  timezone: string;
};

const defaultPreferences: Preferences = {
  emailNotifications: true,
  approvalNotifications: true,
  projectNotifications: true,
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Kolkata",
};

export default function SettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);

  // LOAD PROFILE AND PREFERENCES

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (error) throw error;

        const user = data.user;

        if (!user) {
          throw new Error("Please login to access settings.");
        }

        setEmail(user.email || "");

        const metadata = user.user_metadata || {};

        setName(
          metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            metadata.fullName ||
            ""
        );

        const { data: savedData, error: fetchError } = await supabase
          .from("user_preferences")
          .select("preferences")
          .eq("user_id", user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (savedData) {
          setPreferences({
            ...defaultPreferences,
            ...savedData.preferences,
          });

          localStorage.removeItem("flowmatrix_preferences");
        } else {
          // ONE-TIME MIGRATION FROM OLD LOCAL STORAGE

          const oldSettings = localStorage.getItem(
            "flowmatrix_preferences"
          );

          let initialPreferences = defaultPreferences;

          if (oldSettings) {
            try {
              initialPreferences = {
                ...defaultPreferences,
                ...JSON.parse(oldSettings),
              };
            } catch {
              initialPreferences = defaultPreferences;
            }
          }

          const { error: insertError } = await supabase
            .from("user_preferences")
            .upsert({
              user_id: user.id,
              preferences: initialPreferences,
              updated_at: new Date().toISOString(),
            });

          if (insertError) throw insertError;

          setPreferences(initialPreferences);

          localStorage.removeItem("flowmatrix_preferences");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load settings."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  // SAVE PROFILE

  async function saveProfile() {
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: name.trim(),
        },
      });

      if (error) throw error;

      if (data.user) {
        setName(data.user.user_metadata?.full_name || name.trim());
        setEmail(data.user.email || email);
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // CHANGE PASSWORD

  async function changePassword() {
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setPassword("");
      setConfirmPassword("");

      setMessage("Password changed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change password."
      );
    } finally {
      setSaving(false);
    }
  }

  // SAVE PREFERENCES TO SUPABASE

  async function savePreferences(updated: Preferences) {
    if (preferencesSaving) return;

    const previousPreferences = preferences;

    setPreferences(updated);
    setPreferencesSaving(true);
    setError("");
    setMessage("");

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) throw error;

      if (!data.user) {
        throw new Error("Please login again.");
      }

      const { error: saveError } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: data.user.id,
          preferences: updated,
          updated_at: new Date().toISOString(),
        });

      if (saveError) throw saveError;

      setMessage("Preferences saved successfully.");
    } catch (err) {
      setPreferences(previousPreferences);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save preferences."
      );
    } finally {
      setPreferencesSaving(false);
    }
  }

  // LOADING

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-sm text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* MESSAGE */}

      {(message || error) && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      {/* ACCOUNT PROFILE */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">
          Account Profile
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Manage your account information.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Full Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-lg border p-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Email Address
            </label>

            <input
              type="email"
              value={email}
              readOnly
              className="w-full rounded-lg border bg-gray-100 p-3 text-sm text-gray-500"
            />

            <p className="mt-1 text-xs text-gray-400">
              Email address is currently read-only.
            </p>
          </div>

          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </section>

      {/* SECURITY */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">
          Security
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Change your account password.
        </p>

        <div className="mt-5 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New Password"
            autoComplete="new-password"
            className="w-full rounded-lg border p-3 text-sm outline-none focus:border-blue-500"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            autoComplete="new-password"
            className="w-full rounded-lg border p-3 text-sm outline-none focus:border-blue-500"
          />

          <button
            type="button"
            onClick={changePassword}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Updating..." : "Change Password"}
          </button>
        </div>
      </section>

      {/* NOTIFICATION PREFERENCES */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">
          Notification Preferences
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Choose which notifications you want to see.
        </p>

        <div className="mt-5 space-y-5">
          {[
            {
              key: "emailNotifications" as const,
              title: "Email Notifications",
              description: "Receive email notification preferences.",
            },
            {
              key: "approvalNotifications" as const,
              title: "Approval Notifications",
              description: "Notifications about pending approvals.",
            },
            {
              key: "projectNotifications" as const,
              title: "Project Notifications",
              description: "Updates related to your projects.",
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium">
                  {item.title}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {item.description}
                </p>
              </div>

              <input
                type="checkbox"
                checked={preferences[item.key]}
                disabled={preferencesSaving}
                onChange={(e) =>
                  savePreferences({
                    ...preferences,
                    [item.key]: e.target.checked,
                  })
                }
                className="h-5 w-5 accent-blue-600"
              />
            </label>
          ))}
        </div>
      </section>

      {/* WORKSPACE PREFERENCES */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">
          Workspace Preferences
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Customize your workspace display preferences.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Date Format
            </label>

            <select
              value={preferences.dateFormat}
              disabled={preferencesSaving}
              onChange={(e) =>
                savePreferences({
                  ...preferences,
                  dateFormat: e.target.value,
                })
              }
              className="w-full rounded-lg border p-3 text-sm"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Timezone
            </label>

            <select
              value={preferences.timezone}
              disabled={preferencesSaving}
              onChange={(e) =>
                savePreferences({
                  ...preferences,
                  timezone: e.target.value,
                })
              }
              className="w-full rounded-lg border p-3 text-sm"
            >
              <option value="Asia/Kolkata">India (IST)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">New York</option>
              <option value="Europe/London">London</option>
            </select>
          </div>
        </div>

        {preferencesSaving && (
          <p className="mt-3 text-xs text-gray-500">
            Saving preferences...
          </p>
        )}
      </section>

    </div>
  );
}