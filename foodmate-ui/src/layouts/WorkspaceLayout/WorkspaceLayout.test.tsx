import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { WorkspaceLayout } from './WorkspaceLayout';
import styles from './WorkspaceLayout.module.css';

describe('WorkspaceLayout shell controls', () => {
  it('renders shell actions through the shared shadcn Button primitive', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <WorkspaceLayout sidebarFixture={{ sessions: [], searchValue: '高蛋白' }}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '清除会话搜索' })).toHaveClass('inline-flex');
    expect(screen.getByRole('button', { name: '设置' })).toHaveClass('inline-flex');
    expect(screen.getByRole('button', { name: '收起导航' })).toHaveClass('inline-flex');
    expect(screen.getByRole('button', { name: '通知' })).toHaveClass('inline-flex');
    expect(screen.getByRole('button', { name: '梁同学' })).toHaveClass('inline-flex');
  });

  it('renders the Figma fixture pagination as a compact control', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <WorkspaceLayout sidebarFixture={{ sessions: [], currentPage: 1 }}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    expect(container.querySelector('.sidebar-session-pagination')).toBeInTheDocument();
    expect(container.querySelectorAll('.sidebar-session-pagination svg')).toHaveLength(2);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('omits the search clear control from the Figma fixture shell', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <WorkspaceLayout designChat sidebarFixture={{ sessions: [], searchValue: '高蛋白' }}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText('搜索会话...')).toHaveValue('高蛋白');
    expect(screen.queryByRole('button', { name: '清除会话搜索' })).not.toBeInTheDocument();
  });

  it('hides only the Figma fixture topbar mark letter', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <WorkspaceLayout showKnowledgeTopNav={false} sidebarFixture={{ sessions: [] }}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    const topbarMark = container.querySelector('main header .brand > span');
    const sidebarMark = container.querySelector('aside .brand > span');
    expect(topbarMark).toBeInTheDocument();
    expect(topbarMark).not.toHaveTextContent('F');
    expect(sidebarMark).toHaveTextContent('F');
  });

  it('hides the design chat topbar mark letter without a sidebar fixture', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/chat?state=figma-v2']}>
        <WorkspaceLayout designChat showKnowledgeTopNav={false}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    const topbarMark = container.querySelector('main header .brand > span');
    const sidebarMark = container.querySelector('aside .brand > span');
    expect(topbarMark).toBeInTheDocument();
    expect(topbarMark).not.toHaveTextContent('F');
    expect(sidebarMark).toHaveTextContent('F');
    expect(container.firstElementChild).toHaveClass('designChat');
    expect(container.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
  });

  it('uses the Figma selection surface colors for the design chat fixture', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/chat']}>
        <WorkspaceLayout
          activeModule="chat"
          designChat
          showKnowledgeTopNav={false}
          sidebarFixture={{
            sessions: [{ id: 'session-1', title: '本周饮食分析', subtitle: '今天 12:45', active: true }],
          }}
        >
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    const shell = container.querySelector(`.${styles.designChat}`);
    const activeSection = container.querySelector('.sidebar-session-section-title.active');
    const activeSession = container.querySelector('.sidebar-session-list-item.active');

    expect(shell).toBeInTheDocument();
    expect(activeSection).toBeInTheDocument();
    expect(activeSession).toBeInTheDocument();
    const stylesheet = readFileSync(
      resolve(process.cwd(), 'src/layouts/WorkspaceLayout/WorkspaceLayout.module.css'),
      'utf8',
    );
    expect(stylesheet).toContain('--fm-fixture-sidebar-active-surface: #fbf7f2;');
    expect(stylesheet).toContain('--fm-fixture-session-active-surface: #fffcf9;');
    expect(stylesheet).toContain('--fm-fixture-top-nav-active-surface: #fffefc;');
    expect(stylesheet).not.toContain('--fm-fixture-sidebar-active-surface: rgba(199, 150, 84, 0.08);');
    expect(stylesheet).not.toContain('--fm-fixture-session-active-surface: rgba(255, 246, 226, 0.2);');
    expect(stylesheet).not.toContain('--fm-fixture-top-nav-active-surface: #fffefa;');
  });

  it('uses the Figma green token for design chat brand and agent marks', () => {
    const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

    expect(stylesheet).toContain('--fm-green: #a6d997;');
  });

  it('allows a page to hide only the topbar mark letter while keeping its top navigation', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/knowledge']}>
        <WorkspaceLayout topbarShowMarkLetter={false} sidebarFixture={{ sessions: [] }}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    expect(container.querySelector('main header .brand > span')).not.toHaveTextContent('F');
    expect(container.querySelector('main header a[href="/knowledge"]')).toBeInTheDocument();
    expect(container.querySelector('aside .brand > span')).toHaveTextContent('F');
  });

  it('renders desktop window controls in the Home Figma fixture shell', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <WorkspaceLayout showKnowledgeTopNav={false} sidebarFixture={{ sessions: [] }}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
    expect(container.querySelector('[data-name="window-controls"] img')).toHaveAttribute(
      'src',
      '/assets/figma/workspace/window-controls.svg',
    );
  });

  it.each([
    ['records', '/analysis?view=records&state=v2'],
    ['analysis', '/analysis?state=v2'],
    ['planning', '/planning?state=v2'],
  ] as const)('renders desktop window controls in the %s Figma fixture shell', (activeModule, entry) => {
    const { container } = render(
      <MemoryRouter initialEntries={[entry]}>
        <WorkspaceLayout activeModule={activeModule} showKnowledgeTopNav={false} sidebarFixture={{ sessions: [] }}>
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
  });

  it('supports the Profile Figma sidebar composition with history and fixture controls', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/profile?state=basic']}>
        <WorkspaceLayout
          activeModule="profile"
          profileActiveTab="basic"
          showKnowledgeTopNav
          showWindowControls
          sidebarFixture={{
            sessions: [],
            showTopStatus: true,
          }}
        >
          <div>页面内容</div>
        </WorkspaceLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText('在线代理')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索会话...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起导航' })).toBeInTheDocument();
    expect(container.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
  });
});
