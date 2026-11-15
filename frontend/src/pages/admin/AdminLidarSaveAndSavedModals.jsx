import React from 'react';
import {
  Trash2,
  Server,
  Save,
  FolderOpen,
  FileText,
  Download,
  Lock,
} from 'lucide-react';
import { describeExploreResult } from './exploreResult';

export function AdminLidarSaveAndSavedModals({
  rc,
  isSaveMapModalOpen,
  setIsSaveMapModalOpen,
  saveFromExplore,
  setSaveFromExplore,
  exploreResult,
  handleSaveMap,
  saveMapName,
  setSaveMapName,
  isSavingMap,
  isSavedMapsModalOpen,
  setIsSavedMapsModalOpen,
  savedMapsList,
  triggerMapDownload,
  handleLoadSavedMap,
  handleDeleteSavedMap,
}) {
  return (
    <>
      {/* MODAL: Lưu Bản Đồ SLAM LiDAR */}
      {isSaveMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between border-b pb-3"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-blue-600"/>
                <h3 className="text-sm font-bold"style={{ color: '#262626'}}> {rc("Save, Lock Map & Start Navigation")} </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSaveMapModalOpen(false);
                  setSaveFromExplore(false);
                }}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              > {rc("×")} </button>
            </div>

            {/* Mo ra vi robot tu quet xong: bao ket qua truoc khi dat ten */}
            {saveFromExplore && (() => {
              const info = describeExploreResult(exploreResult);
              const tone = info.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : info.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-stone-200 bg-stone-50 text-stone-700';
              return (
                <div className={`p-3 rounded-lg border text-xs leading-relaxed ${tone}`}>
                  <span className="font-bold block mb-0.5">{info.title}</span>
                  {info.detail}
                  <span className="block mt-1 opacity-80">
                    Đặt tên rồi bấm Lưu. Bấm Hủy nếu muốn lái tay quét thêm (SLAM vẫn giữ bản đồ), lưu sau bằng nút “2. LƯU & KHÓA”.
                  </span>
                </div>
              );
            })()}

            <form onSubmit={handleSaveMap} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1"style={{ color: '#8C8C8C'}}> {rc("MAP NAME (UNIQUE IDENTIFIER)")} </label>
                <input
                  type="text"
                  required
                  value={saveMapName}
                  onChange={(e) => setSaveMapName(e.target.value)}
                  placeholder="VD: tang_1_sanh, phong_hop_a, phong_lab..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none font-mono"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626'}}
                />
              </div>

              <div className="p-3 rounded-lg border text-xs leading-relaxed"style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#555'}}>
                <span className="font-bold block text-stone-800 mb-1"> {rc("EXPORT FORMATS:")} </span>
                • <strong>JSON</strong> {rc(": Instant display in Web Admin.")} <br />
                • <strong>ROS 2 Nav2 (.yaml & .pgm)</strong> {rc(": Autonomous Navigation, Map Server & AMCL.")} <br />
                • <strong>PostgreSQL Database</strong> {rc(": Business metadata and waypoint structure.")} <br />
                • <strong> {rc("Computer Downloads")} </strong> {rc(": Automatically package the")} <code>.zip</code> {rc("file and download it to your computer.")} </div>

              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] text-blue-800 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600 shrink-0"/>
                <span> {rc("Save the live ROS 2 map, lock it, switch to")} <strong> {rc("static-map Navigation")} </strong> {rc("and download the ZIP.")} </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSaveMapModalOpen(false);
                    setSaveFromExplore(false);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626'}}
                > {rc("Cancel")} </button>
                <button
                  type="submit"
                  disabled={isSavingMap}
                  className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF'}}
                >
                  <Save className="w-3.5 h-3.5"/>
                  <span>{isSavingMap ? rc("Saving & switching mode..."): rc("Save & Start Navigation")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Danh Sách Bản Đồ Đã Lưu */}
      {isSavedMapsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-2xl w-full rounded-2xl border p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between border-b pb-3 shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-600"/>
                <h3 className="text-sm font-bold"style={{ color: '#262626'}}> {rc("Saved Maps on Robot")} </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSavedMapsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              > {rc("×")} </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {savedMapsList.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500 font-mono"> {rc("No saved maps yet.")} <br /> {rc("Scan the room and select \"SAVE MAP\" to save your first map.")} </div>
              ) : (
                savedMapsList.map((mapItem) => (
                  <div
                    key={mapItem.name}
                    className="p-3 rounded-xl border flex items-center justify-between gap-3 hover:bg-stone-50 transition-all"
                    style={{ borderColor: '#E3DFD5', backgroundColor: '#FAF8F5'}}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-stone-600"/>
                        <span className="font-bold text-xs text-stone-900 font-mono">{mapItem.name}</span>
                        {mapItem.has_ros2_yaml && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                            ROS 2 YAML/PGM
                          </span>
                        )}
                        {mapItem.in_database && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold border border-blue-300">
                            PostgreSQL DB
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono">
                        {mapItem.created_at || rc("Time: N/A")} • {mapItem.width}x{mapItem.height} ({mapItem.resolution}m/px)
                      </div>
                      {mapItem.statistics && (
                        <div className="text-[10px] text-stone-600"> {rc("Obstacles:")} <strong>{mapItem.statistics.occupied_cells}</strong> {rc("cells | Free:")} <strong>{mapItem.statistics.free_cells}</strong> {rc("cells")} </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => triggerMapDownload(mapItem.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 cursor-pointer shadow-xs flex items-center gap-1 transition-all"
                        title={rc("Download map package (.zip containing .yaml + .pgm) to Downloads")}
                      >
                        <Download className="w-3 h-3 text-blue-600"/>
                        <span> {rc("Download")} </span>
                      </button>
                      <button
                        onClick={() => handleLoadSavedMap(mapItem.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-white hover:bg-stone-100 text-stone-800 cursor-pointer shadow-xs"
                        style={{ borderColor: '#BFBFBD'}}
                        title={rc("Load this map into SLAM")}
                      > {rc("Load Map")} </button>
                      <button
                        onClick={() => handleDeleteSavedMap(mapItem.name)}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title={rc("Delete this map")}
                      >
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <button
                type="button"
                onClick={() => setIsSavedMapsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626'}}
              > {rc("Close")} </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
