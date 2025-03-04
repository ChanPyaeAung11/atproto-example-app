import { Agent } from "@atproto/api";
import { IdResolver, MemoryCache } from "@atproto/identity";
import * as Profile from "#/lexicon/types/app/bsky/actor/profile";

const HOUR = 60e3 * 60;
const DAY = HOUR * 24;

export function createIdResolver() {
  return new IdResolver({
    didCache: new MemoryCache(HOUR, DAY),
  });
}

export interface BidirectionalResolver {
  resolveDidToHandle(did: string): Promise<string>;
  resolveDidsToHandles(dids: string[]): Promise<Record<string, string>>;
  resolveDidToDisplayName(dids: string[], agent: Agent): Promise<string>;
  resolveDidsToDisplayNames(
    dids: string[],
    agent: Agent,
  ): Promise<Record<string, string>>;
}

export function createBidirectionalResolver(resolver: IdResolver) {
  return {
    async resolveDidToHandle(did: string): Promise<string> {
      // console.log("here is did: ", did);
      const didDoc = await resolver.did.resolveAtprotoData(did);
      const resolvedHandle = await resolver.handle.resolve(didDoc.handle);
      //console.log("resolvedHandle : ", resolvedHandle);

      if (resolvedHandle === did) {
        return didDoc.handle;
      }
      return did;
    },

    async resolveDidsToHandles(
      dids: string[],
    ): Promise<Record<string, string>> {
      const didHandleMap: Record<string, string> = {};
      const resolves = await Promise.all(
        dids.map((did) => this.resolveDidToHandle(did).catch((_) => did)),
      );
      for (let i = 0; i < dids.length; i++) {
        didHandleMap[dids[i]] = resolves[i];
      }
      return didHandleMap;
    },

    async resolveDidsToDisplayNames(
      dids: string[],
      agent: Agent,
    ): Promise<Record<string, string>> {
      const didDisplayNameMap: Record<string, string> = {};
      const resolves = await Promise.all(
        dids.map((did) => this.resolveDidToDisplayName(did, agent)),
      );
      for (let i = 0; i < dids.length; i++) {
        didDisplayNameMap[dids[i]] = resolves[i];
      }
      //console.log(didDisplayNameMap);
      return didDisplayNameMap;
    },

    async resolveDidToDisplayName(did: string, agent: Agent): Promise<string> {
      const profile = await this.getProfileInfo(did, agent);
      //console.log(profile);
      return profile;
    },

    async getProfileInfo(did: string, agent: Agent): Promise<string> {
      // try bsky (1st party)
      try {
        const bskyDisplayName = await this.getBlueskyProfile(did, agent);
        if (bskyDisplayName) return bskyDisplayName;
      } catch (error) {
        console.warn(`Failed to get Bsky Profile for ${did}`, error);
      }

      // generic DID Documents here (currently, stil bsky. update based on schemas)
      const profileResponse = await agent.com.atproto.repo
        .getRecord({
          repo: did,
          collection: "app.bsky.actor.profile",
          rkey: "self",
        })
        .catch(() => undefined);

      const profileRecord = profileResponse?.data;
      //console.log(profileRecord);
      const profile =
        profileRecord &&
        Profile.isRecord(profileRecord.value) &&
        Profile.validateRecord(profileRecord.value).success
          ? profileRecord.value
          : {};
      //console.log(profile);
      if (profile.displayName) return profile.displayName;
      return did;

      return did;
    },

    async getBlueskyProfile(did: string, agent: Agent): Promise<string> {
      const response = await agent.getProfile({
        actor: did,
      });
      if (response.success && response.data.displayName)
        return response.data.displayName;

      return did;
    },
  };
}
