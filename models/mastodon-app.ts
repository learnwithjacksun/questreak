import { model, models, Schema, type Model } from "mongoose";

/** One OAuth client per Mastodon server, registered on first use. */
export interface IMastodonApp {
  instance: string; // https://mastodon.social
  clientId: string;
  clientSecretEnc: string;
  redirectUri: string;
  createdAt: Date;
}

const schema = new Schema<IMastodonApp>(
  {
    instance: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    clientSecretEnc: { type: String, required: true },
    redirectUri: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const MastodonApp =
  (models.MastodonApp as Model<IMastodonApp>) || model<IMastodonApp>("MastodonApp", schema);
