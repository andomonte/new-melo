import React from 'react';

interface TabNavigationProps {
  tabs: { name: string; key: string }[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  setActiveTab,
}) => {
  return (
    <nav className="flex space-x-4 border-b-2 mb-4 text-blue-600 dark:text-blue-300">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`px-4 py-2 ${
            activeTab === tab.key
              ? 'border-b-4 border-blue-600 dark:border-blue-300 font-bold'
              : ''
          }`}
        >
          {tab.name}
        </button>
      ))}
    </nav>
  );
};

export default TabNavigation;
