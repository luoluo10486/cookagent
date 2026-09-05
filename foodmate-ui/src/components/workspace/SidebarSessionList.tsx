import { Archive, ChevronLeft, ChevronRight, MessageCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { FigmaWorkspaceAsset, type WorkspaceFixtureVariant } from './FigmaWorkspaceAsset';
import type { SessionSummary } from '../../types/session';
import styles from './SidebarSessionList.module.css';

type SessionAction = 'rename' | 'archive' | 'unarchive' | 'delete';
type SidebarSessionListProps = {
  sessions: SessionSummary[];
  onAction?: (action: SessionAction, session: SessionSummary) => void;
  currentPage?: number;
  showHistory?: boolean;
  fixtureVariant?: WorkspaceFixtureVariant;
};

export function SidebarSessionList({
  sessions,
  onAction,
  currentPage = 1,
  showHistory = true,
  fixtureVariant,
}: SidebarSessionListProps) {
  return (
    <section className={`${styles.section} sidebar-session-section`}>
      <NavLink
        className={({ isActive }) =>
          `${styles.sectionTitle} sidebar-session-section-title ${isActive ? styles.active : ''}`
        }
        to="/chat"
      >
        {fixtureVariant ? (
          <FigmaWorkspaceAsset variant={fixtureVariant} name="agentChat" />
        ) : (
          <MessageCircle aria-hidden="true" />
        )}
        <span>Agent 对话</span>
      </NavLink>
      {showHistory ? (
        <>
          <div className={`${styles.list} sidebar-session-list`}>
            {sessions.map((session) => {
              const archived = (session.status as string) === 'archived';
              return (
                <div
                  className={`${styles.item} sidebar-session-list-item ${session.active ? styles.active : ''}`}
                  key={session.id}
                >
                  <NavLink className={styles.itemLink} to={`/chat/${session.id}`}>
                    {fixtureVariant ? (
                      <FigmaWorkspaceAsset
                        className={styles.figmaSessionDot}
                        variant={fixtureVariant}
                        name={session.active ? 'sessionDotActive' : 'sessionDotDefault'}
                      />
                    ) : (
                      <span className={styles.dot} aria-hidden="true" />
                    )}
                    <span className={styles.title}>{session.title}</span>
                    <span className={styles.meta}>{session.subtitle}</span>
                  </NavLink>
                  {onAction ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className={styles.moreButton}
                          variant="ghost"
                          size="icon"
                          aria-label={`管理${session.title}`}
                          title={`管理${session.title}`}
                          type="button"
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onAction('rename', session)}>
                          <Pencil aria-hidden="true" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onAction(archived ? 'unarchive' : 'archive', session)}>
                          <Archive aria-hidden="true" />
                          {archived ? '取消归档' : '归档'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onAction('delete', session)}>
                          <Trash2 aria-hidden="true" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className={`${styles.pagination} sidebar-session-pagination`} aria-label="会话分页">
            <Button variant="ghost" size="icon" aria-label="上一页" disabled type="button">
              {fixtureVariant ? (
                <span className={styles.paginationGlyph}>{'<'}</span>
              ) : (
                <ChevronLeft aria-hidden="true" />
              )}
            </Button>
            <span>{currentPage} / 3</span>
            <Button variant="ghost" size="icon" aria-label="下一页" type="button">
              {fixtureVariant ? (
                <span className={styles.paginationGlyph}>{'>'}</span>
              ) : (
                <ChevronRight aria-hidden="true" />
              )}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export type { SessionAction };
