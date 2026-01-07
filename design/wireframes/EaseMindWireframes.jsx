import React, { useState } from 'react';

const EaseMindWireframes = () => {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedSolution, setSelectedSolution] = useState(null);

  const alerts = [
    {
      id: 1,
      type: 'schedule',
      title: '17:30–18:30 孩子接送無人負責',
      reason: '你會議延後 + 另一半外出',
      severity: 'high',
      details: {
        time: 'Wed 17:30–18:30',
        you: '會議到18:00',
        partner: '外出',
        child: '需要接送',
        consequence: '孩子可能無人接送'
      }
    },
    {
      id: 2,
      type: 'inventory',
      title: '尿布剩2天，預計週五用完',
      reason: '上次購買已10天',
      severity: 'medium',
      details: {
        item: '尿布',
        remaining: '2天（預計Fri用完）',
        lastPurchase: '10天前',
        consequence: '週五可能臨時缺貨'
      }
    }
  ];

  const solutions = [
    {
      id: 'a',
      label: '解法 A（最穩定）',
      recommended: true,
      description: '請另一半晚30分鐘外出，並順路買尿布',
      impacts: [
        '你的會議不變',
        '孩子準時接送',
        '尿布補上，不用再跑一次'
      ]
    },
    {
      id: 'b',
      label: '解法 B',
      recommended: false,
      description: '你提前離開會議15分鐘，順路買尿布',
      impacts: [
        '會議需說明',
        '家庭無風險',
        '但你會比較累'
      ]
    },
    {
      id: 'c',
      label: '解法 C',
      recommended: false,
      description: '請阿公接小孩，你晚點買尿布',
      impacts: [
        '阿公需配合',
        '尿布延後一天買'
      ]
    }
  ];

  const generatedMessage = `我看到17:30接送有衝突，
你能晚30分鐘出門嗎？
順便幫忙買一包尿布，
我這邊會議照開，謝謝你～`;

  // Phone Frame Component
  const PhoneFrame = ({ children, title }) => (
    <div className="bg-gray-100 p-4 rounded-lg">
      <div className="text-xs text-gray-500 mb-2 text-center font-mono">{title}</div>
      <div className="bg-white rounded-3xl shadow-lg w-80 h-auto min-h-96 overflow-hidden border-4 border-gray-800 mx-auto">
        <div className="bg-gray-800 h-6 flex items-center justify-center">
          <div className="w-16 h-3 bg-gray-700 rounded-full"></div>
        </div>
        <div className="p-4 font-mono text-sm">
          {children}
        </div>
      </div>
    </div>
  );

  // Screen 1: Home Dashboard
  const HomeScreen = () => (
    <PhoneFrame title="Screen 1: 家庭狀態首頁">
      <div className="border-b border-dashed border-gray-300 pb-2 mb-3">
        <div className="text-xs text-gray-500">Today · Wed Jan 08</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-lg">家庭狀態：</span>
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">
            🔴 高風險
          </span>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-3">
        <div className="font-bold text-yellow-800 mb-2">
          ⚠️ 兩件事需要處理
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {alerts.map((alert, idx) => (
          <div
            key={alert.id}
            className="border border-gray-300 rounded p-3 hover:bg-gray-50 cursor-pointer"
            onClick={() => {
              setSelectedAlert(alert);
              setCurrentScreen('detail');
            }}
          >
            <div className="font-medium text-sm">{idx + 1}. {alert.title}</div>
            <div className="text-xs text-gray-500 mt-1">原因：{alert.reason}</div>
          </div>
        ))}
      </div>

      <button
        className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium"
        onClick={() => {
          setSelectedAlert(alerts[0]);
          setCurrentScreen('detail');
        }}
      >
        👉 查看建議解法
      </button>
    </PhoneFrame>
  );

  // Screen 2: Alert Detail
  const DetailScreen = () => (
    <PhoneFrame title="Screen 2: 警報詳情頁">
      <button
        className="text-gray-500 text-sm mb-3 flex items-center"
        onClick={() => setCurrentScreen('home')}
      >
        ← 返回
      </button>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
        <div className="font-bold">
          ⚠️ {selectedAlert?.type === 'schedule' ? '行程衝突' : '庫存即將用完'}
        </div>
      </div>

      {selectedAlert?.type === 'schedule' ? (
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-500">時間：</span>
            <span>{selectedAlert.details.time}</span>
          </div>
          <div className="border-t border-dashed pt-2">
            <div className="font-medium mb-1">發生什麼事？</div>
            <ul className="text-gray-600 space-y-1 ml-2">
              <li>- 你：{selectedAlert.details.you}</li>
              <li>- 另一半：{selectedAlert.details.partner}</li>
              <li>- 孩子：{selectedAlert.details.child}</li>
            </ul>
          </div>
          <div className="bg-red-50 p-2 rounded text-red-700 text-xs">
            如果不處理：{selectedAlert.details.consequence}
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-500">品項：</span>
            <span>{selectedAlert?.details.item}</span>
          </div>
          <div>
            <span className="text-gray-500">剩餘：</span>
            <span>{selectedAlert?.details.remaining}</span>
          </div>
          <div>
            <span className="text-gray-500">上次購買：</span>
            <span>{selectedAlert?.details.lastPurchase}</span>
          </div>
          <div className="bg-red-50 p-2 rounded text-red-700 text-xs">
            如果不處理：{selectedAlert?.details.consequence}
          </div>
        </div>
      )}

      <button
        className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium mt-4"
        onClick={() => setCurrentScreen('solutions')}
      >
        👉 看解決方式
      </button>
    </PhoneFrame>
  );

  // Screen 3: Solutions
  const SolutionsScreen = () => (
    <PhoneFrame title="Screen 3: 建議解法頁">
      <button
        className="text-gray-500 text-sm mb-3 flex items-center"
        onClick={() => setCurrentScreen('detail')}
      >
        ← 返回
      </button>

      <div className="font-bold mb-3 border-b pb-2">建議解法（選一個）</div>

      <div className="space-y-3">
        {solutions.map((solution) => (
          <div
            key={solution.id}
            className={`border rounded p-3 cursor-pointer transition-all ${
              selectedSolution === solution.id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setSelectedSolution(solution.id)}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selectedSolution === solution.id ? 'border-green-500' : 'border-gray-400'
              }`}>
                {selectedSolution === solution.id && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
              </div>
              <span className="font-medium text-sm">
                {solution.label}
                {solution.recommended && (
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">
                    推薦
                  </span>
                )}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-2 ml-6">
              {solution.description}
            </div>
            <div className="mt-2 ml-6">
              <div className="text-xs text-gray-500 mb-1">影響：</div>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {solution.impacts.map((impact, i) => (
                  <li key={i}>• {impact}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <button
        className={`w-full py-3 rounded-lg font-medium mt-4 ${
          selectedSolution
            ? 'bg-gray-800 text-white'
            : 'bg-gray-200 text-gray-500'
        }`}
        disabled={!selectedSolution}
        onClick={() => setCurrentScreen('confirm')}
      >
        確認選擇 →
      </button>
    </PhoneFrame>
  );

  // Screen 4: Confirm & Share
  const ConfirmScreen = () => (
    <PhoneFrame title="Screen 4: 協調確認頁">
      <button
        className="text-gray-500 text-sm mb-3 flex items-center"
        onClick={() => setCurrentScreen('solutions')}
      >
        ← 返回
      </button>

      <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
        <div className="text-green-700 font-medium text-sm">
          ✓ 已選：{solutions.find(s => s.id === selectedSolution)?.label}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">系統建議你這樣說：</div>
        <div className="bg-gray-100 rounded-lg p-4 font-sans text-sm whitespace-pre-line border-2 border-dashed border-gray-300">
          {generatedMessage}
        </div>
      </div>

      <div className="space-y-2">
        <button className="w-full border border-gray-300 py-3 rounded-lg font-medium flex items-center justify-center gap-2">
          📋 複製文字
        </button>
        <button className="w-full bg-green-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2">
          💬 分享到 LINE
        </button>
      </div>

      <div className="mt-4 text-center">
        <button
          className="text-gray-500 text-sm underline"
          onClick={() => {
            setCurrentScreen('home');
            setSelectedAlert(null);
            setSelectedSolution(null);
          }}
        >
          完成，返回首頁
        </button>
      </div>
    </PhoneFrame>
  );

  // Onboarding Screens
  const OnboardingScreen = () => (
    <PhoneFrame title="Onboarding Flow">
      <div className="text-center py-4">
        <div className="text-2xl mb-2">👋</div>
        <div className="font-bold text-lg mb-1">歡迎來到 EaseMind</div>
        <div className="text-sm text-gray-500">讓我們一起減輕你的腦負荷</div>
      </div>

      <div className="space-y-4 mt-4">
        <div className="border rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Step 1</div>
          <div className="font-medium text-sm mb-2">你是家裡的主要規劃者嗎？</div>
          <div className="flex gap-2">
            <button className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">是</button>
            <button className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">不是，但想試</button>
          </div>
        </div>

        <div className="border rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Step 2</div>
          <div className="font-medium text-sm mb-2">快速設定</div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>• 平日接送誰負責？</div>
            <div>• 常買的消耗品？（預設10項）</div>
          </div>
        </div>

        <div className="border rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Step 3</div>
          <div className="font-medium text-sm mb-2">連結行事曆</div>
          <button className="w-full bg-gray-100 rounded py-2 text-sm">
            📅 Connect Calendar
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 mt-4">
        3分鐘內完成設定
      </div>
    </PhoneFrame>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">EaseMind Low-Fi Wireframes</h1>
        <p className="text-gray-600 mb-6">點擊畫面中的按鈕可以體驗完整流程</p>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['home', 'detail', 'solutions', 'confirm', 'onboarding'].map((screen) => (
            <button
              key={screen}
              onClick={() => {
                setCurrentScreen(screen);
                if (screen === 'detail') setSelectedAlert(alerts[0]);
              }}
              className={`px-4 py-2 rounded-lg text-sm ${
                currentScreen === screen
                  ? 'bg-gray-800 text-white'
                  : 'bg-white border hover:bg-gray-50'
              }`}
            >
              {screen === 'home' && '1. 首頁'}
              {screen === 'detail' && '2. 詳情'}
              {screen === 'solutions' && '3. 解法'}
              {screen === 'confirm' && '4. 確認'}
              {screen === 'onboarding' && 'Onboarding'}
            </button>
          ))}
        </div>

        {/* Current Screen */}
        <div className="flex justify-center">
          {currentScreen === 'home' && <HomeScreen />}
          {currentScreen === 'detail' && <DetailScreen />}
          {currentScreen === 'solutions' && <SolutionsScreen />}
          {currentScreen === 'confirm' && <ConfirmScreen />}
          {currentScreen === 'onboarding' && <OnboardingScreen />}
        </div>

        {/* Design Principles */}
        <div className="mt-8 bg-white rounded-lg p-6">
          <h2 className="font-bold mb-4">設計原則</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="border-l-4 border-blue-500 pl-3">
              <div className="font-medium">不思考原則</div>
              <div className="text-gray-500">打開就知道「現在有沒有事要處理」</div>
            </div>
            <div className="border-l-4 border-green-500 pl-3">
              <div className="font-medium">少決策原則</div>
              <div className="text-gray-500">每次只選一件事（或一鍵確認）</div>
            </div>
            <div className="border-l-4 border-purple-500 pl-3">
              <div className="font-medium">替我扛責任原則</div>
              <div className="text-gray-500">系統先判斷、替我想好解法、替我把話說好</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EaseMindWireframes;
