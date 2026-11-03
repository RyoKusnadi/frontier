'use client';

import { createContext, useContext } from 'react';
import { AlertDialog, Button, Flex, Text } from '@raystack/apsara';
import type {
  DeleteBlocker,
  DeleteBlockedContext,
  DeleteBlockedPayload
} from '../../../shared/types';
import { useFrontier } from '../../contexts/FrontierContext';
import {
  useTerminology,
  type TerminologyMap
} from '../../hooks/useTerminology';
import {
  GENERIC_DELETE_BLOCKED_MESSAGE,
  blockerLines,
  type BlockerWording
} from '../../utils/delete-blockers';
import styles from './delete-blocked-dialog.module.css';

export type { DeleteBlockedPayload };

export type DeleteBlockedDialogHandle = ReturnType<
  typeof AlertDialog.createHandle<DeleteBlockedPayload>
>;

interface BulletGroup {
  title?: string;
  lines: string[];
}

function defaultContent(
  context: DeleteBlockedContext,
  t: TerminologyMap,
  messages: Record<string, string>,
  wording: BlockerWording
): { title: string; description: string; groups: BulletGroup[] } {
  const { entityLabel } = context;
  switch (context.entity) {
    case 'organization':
      return {
        title: `Unable to delete ${entityLabel}`,
        description: `Please resolve the following issues before deleting this ${entityLabel}:`,
        groups: [{ lines: blockerLines(context.blockers, messages, wording) }]
      };
    case 'project':
      return {
        title: `Unable to delete ${entityLabel}`,
        description: `This ${entityLabel} cannot be deleted because it contains resources that need to be addressed first.`,
        groups: [{ lines: blockerLines(context.blockers, messages, wording) }]
      };
    case 'user': {
      const org = t.organization({ case: 'lower' });
      if (context.soleOwnerOf.length > 0) {
        return {
          title: `Transfer ${org} ownership`,
          description: `You’re the only owner of one or more ${t.organization({ case: 'lower', plural: true })}. Before deleting your account, transfer ownership of each affected ${org} to another member.\n\nOnce ownership has been transferred, you can proceed with account deletion.`,
          groups: []
        };
      }
      return {
        title: 'Unable to delete account',
        description: 'Please resolve the following issues before deleting your account:',
        groups:
          context.organizationsToDelete.length > 0
            ? context.organizationsToDelete.map(({ title, blockers }) => ({
                title,
                lines: blockerLines(blockers, messages, wording)
              }))
            : [{ lines: [GENERIC_DELETE_BLOCKED_MESSAGE] }]
      };
    }
  }
}

const OpenDeleteBlockedContext = createContext<DeleteBlockedContext | null>(
  null
);

export interface DeleteBlockedDialogHostProps {
  handle: DeleteBlockedDialogHandle;
}

export function DeleteBlockedDialogHost({ handle }: DeleteBlockedDialogHostProps) {
  return (
    <AlertDialog handle={handle}>
      {({ payload }) =>
        payload ? (
          <AlertDialog.Content className={styles.content}>
            <DeleteBlockedContent
              payload={payload as DeleteBlockedPayload}
              close={() => handle.close()}
            />
          </AlertDialog.Content>
        ) : null
      }
    </AlertDialog>
  );
}

export function DeleteBlockedContent({
  payload,
  close
}: {
  payload: DeleteBlockedPayload;
  close: () => void;
}) {
  const t = useTerminology();
  const { slots } = useFrontier();
  const context: DeleteBlockedContext = {
    ...payload,
    entityLabel: t[payload.entity]({ case: 'lower' }),
    close
  };
  const body = slots.deleteBlockedDialog?.(context);
  const isEmpty = body == null || typeof body === 'boolean';
  return (
    <OpenDeleteBlockedContext.Provider value={context}>
      {isEmpty ? <DeleteBlockedDialog /> : body}
    </OpenDeleteBlockedContext.Provider>
  );
}

export interface DeleteBlockedDialogProps {
  title?: string;
  description?: string;
  blockers?: DeleteBlocker[];
  messages?: Record<string, string>;
}

export function DeleteBlockedDialog({
  title,
  description,
  blockers,
  messages = {}
}: DeleteBlockedDialogProps) {
  const context = useContext(OpenDeleteBlockedContext);
  const t = useTerminology();
  const { basePlan } = useFrontier();
  if (!context) {
    throw new Error(
      'DeleteBlockedDialog must be returned from the deleteBlockedDialog slot on FrontierProvider.'
    );
  }

  const wording = {
    organizationLabel: t.organization({ case: 'lower' }),
    basePlanTitle: basePlan?.title
  };
  const content = defaultContent(context, t, messages, wording);
  const groups = blockers
    ? [{ lines: blockerLines(blockers, messages, wording) }]
    : content.groups;

  return (
    <>
      <AlertDialog.Header>
        <AlertDialog.Title>{title ?? content.title}</AlertDialog.Title>
      </AlertDialog.Header>
      <AlertDialog.Body>
        <Flex direction="column" gap={5}>
          <Text
            size="small"
            variant="secondary"
            className={styles.description}
          >
            {description ?? content.description}
          </Text>
          {groups.map(({ title: groupTitle, lines }, index) => (
            <Flex key={index} direction="column" gap={2}>
              {groupTitle && (
                <Text size="small" weight="medium">
                  {groupTitle}
                </Text>
              )}
              {lines.length > 0 && (
                <Text
                  size="small"
                  variant="secondary"
                  render={<ul className={styles.list} />}
                >
                  {lines.map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </Text>
              )}
            </Flex>
          ))}
        </Flex>
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <AlertDialog.Close
          render={
            <Button
              variant="outline"
              color="neutral"
              data-test-id="frontier-sdk-delete-blocked-close-btn"
            >
              Close
            </Button>
          }
        />
      </AlertDialog.Footer>
    </>
  );
}
