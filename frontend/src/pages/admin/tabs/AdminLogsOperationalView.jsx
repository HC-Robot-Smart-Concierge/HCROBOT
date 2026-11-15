import React from 'react';
import { RotateCw } from 'lucide-react';
import { Pagination } from '../../../components/common/Pagination';

export const AdminLogsOperationalView = ({
  language, selectedLevel, setSelectedLevel, selectedCategory, setSelectedCategory, selectedDepartment, setSelectedDepartment, handleManualRefresh, searchQuery, setSearchQuery, handleSearchSubmit, setCurrentPage, isLoading, logs, setSelectedLog, formatTimestamp, getLevelBadgeStyle, formatLogMessage, handleOpenTrace, currentPage, totalLogs, pageSize, handlePageChange,
}) => (
        <>
          {/* Filter Bar */}
          <div
            className="p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2.5"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            <form onSubmit={handleSearchSubmit} className="w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('logsSearchPlaceholder')}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              />
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Nút làm mới icon xoay đặt bên trái Tất cả mức độ */}
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isLoading}
                title={t('logsRefreshTooltip')}
                className="p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:bg-[#E9E5DC] active:scale-95 flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <option value="ALL">{t('logsAllLevels')}</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <option value="ALL">{t('logsAllCategories')}</option>
                <option value="AUDIT">{t('logsCatAudit')}</option>
                <option value="SYSTEM">{t('logsCatSystem')}</option>
                <option value="ROBOT">{t('logsCatRobot')}</option>
                <option value="AI">{t('logsCatAi')}</option>
                <option value="SERVICE">{t('logsCatService')}</option>
              </select>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                <option value="ALL">{t('logsAllDepartments')}</option>
                <option value="reception">{t('deptReception')}</option>
                <option value="housekeeping">{t('deptHousekeeping')}</option>
                <option value="room_service">{t('deptFB')}</option>
                <option value="bell_services">{t('deptBell')}</option>
                <option value="maintenance">{t('deptMaintenance')}</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div
            className="rounded-xl border overflow-hidden shadow-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    <th className="py-2 px-3 w-28">{t('logsColTime')}</th>
                    <th className="py-2 px-3 w-24 text-center">{t('logsColLevel')}</th>
                    <th className="py-2 px-3 w-32">{t('logsColCategory')}</th>
                    <th className="py-2 px-3 w-32">{t('logsColActor')}</th>
                    <th className="py-2 px-3">{t('logsColMessage')}</th>
                    <th className="py-2 px-3 w-32 text-right">{t('logsColAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {isLoading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                        {t('logsLoading')}
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center" style={{ color: '#8C8C8C' }}>
                        {t('logsEmpty')}
                      </td>
                    </tr>
                  ) : (
                    logs.map((item) => {
                      const badgeStyle = getLevelBadgeStyle(item.level);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#F2EFE9]/50 transition-colors"
                          style={{ borderColor: '#E9E5DC' }}
                        >
                          <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                            {formatTimestamp(item.timestamp)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                              style={badgeStyle}
                            >
                              {item.level}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-[11px]" style={{ color: '#262626' }}>
                            {item.category}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                            {item.actor_id || item.actor_type || 'N/A'}
                          </td>
                          <td className="py-2 px-3 font-medium text-[11px]" style={{ color: '#262626' }}>
                            {formatLogMessage(item.message)}
                          </td>
                          <td className="py-2 px-3 text-right space-x-1.5">
                            {item.correlation_id && (
                              <button
                                onClick={() => handleOpenTrace(item.correlation_id)}
                                className="text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer hover:bg-stone-200"
                                style={{
                                  backgroundColor: '#E9E5DC',
                                  borderColor: '#BFBFBD',
                                  color: '#262626',
                                }}
                                title={t('logsActionTrace')}
                              >
                                {t('logsActionTrace')}
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedLog(item)}
                              className="text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer hover:bg-stone-200"
                              style={{
                                backgroundColor: '#E9E5DC',
                                borderColor: '#BFBFBD',
                                color: '#262626',
                              }}
                            >
                              {t('logsActionView')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={totalLogs}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              className="border-t px-3 py-2"
            />
          </div>
        </>
);
