import AvatarShop from "./AvatarShop.jsx";
import ClassLeaderboard from "./ClassLeaderboard.jsx";
import MysteryChestPanel from "./MysteryChestPanel.jsx";
import SeasonalEventsPanel from "./SeasonalEventsPanel.jsx";
import TeamChallenge from "./TeamChallenge.jsx";

const TAB_COMPONENTS = {
  avatar: AvatarShop,
  team: TeamChallenge,
  leaderboard: ClassLeaderboard,
  chests: MysteryChestPanel,
  events: SeasonalEventsPanel,
};

function RewardCenter({ activeTab, extensions }) {
  const ActivePanel = TAB_COMPONENTS[activeTab] ?? AvatarShop;

  if (activeTab === "avatar") {
    return (
      <ActivePanel
        lexicoins={extensions.lexicoins}
        onBuy={extensions.purchaseItem}
        onEquip={extensions.equipItem}
        shopCategories={extensions.shopCategories}
        shopItems={extensions.shopItems}
      />
    );
  }

  if (activeTab === "team") {
    return (
      <ActivePanel
        onJoinTeam={extensions.selectTeam}
        team={extensions.team}
        teamProgress={extensions.teamProgress}
        teams={extensions.teams}
      />
    );
  }

  if (activeTab === "leaderboard") {
    return (
      <ActivePanel
        entries={extensions.leaderboardEntries}
        leaderboardCategories={extensions.leaderboardCategories}
        onSaveSettings={extensions.saveLeaderboardSettings}
        rewardState={extensions.rewardState}
      />
    );
  }

  if (activeTab === "chests") {
    return (
      <ActivePanel
        availableChests={extensions.availableChests}
        chestResult={extensions.chestResult}
        onClearResult={extensions.clearChestResult}
        onOpenChest={extensions.openChest}
      />
    );
  }

  return (
    <ActivePanel
      onClaimMilestone={extensions.claimMilestone}
      seasonalEvent={extensions.seasonalEvent}
    />
  );
}

export default RewardCenter;
