import { SendHorizontal, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FigmaWorkspaceAsset, type WorkspaceFixtureVariant } from './FigmaWorkspaceAsset';
import styles from './Composer.module.css';

type ComposerProps = {
  value?: string;
  placeholder?: string;
  running?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onSend?: () => void;
  onStop?: () => void;
  fixtureVariant?: WorkspaceFixtureVariant;
};

export function Composer({
  value,
  placeholder = '让 FoodMate 计算、分析、记录或规划...',
  running = false,
  disabled = false,
  onChange,
  onSend,
  onStop,
  fixtureVariant,
}: ComposerProps) {
  const handleSubmit = () => {
    if (running) {
      onStop?.();
      return;
    }

    onSend?.();
  };

  return (
    <footer className={styles.composer}>
      <div className={styles.inputRow}>
        <Input
          className={styles.input}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={(event) => {
            const composing = event.nativeEvent.isComposing || event.keyCode === 229;
            if (event.key === 'Enter' && !event.shiftKey && !composing) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          aria-label={running ? '停止生成' : '发送消息'}
          className={styles.iconButton}
          disabled={!running && disabled}
          variant={running ? 'destructive' : 'default'}
          size="icon"
          data-state={running ? 'running' : 'idle'}
          onClick={handleSubmit}
        >
          {running ? (
            <Square />
          ) : fixtureVariant ? (
            <FigmaWorkspaceAsset variant={fixtureVariant} name="send" />
          ) : (
            <SendHorizontal />
          )}
        </Button>
      </div>
    </footer>
  );
}
