import { PrismaClient } from '@prisma/client';
import {
  getPhoneVariants,
  isGenericWhatsAppName,
  isLikelyBrazilianPhoneId,
  normalizeContactName,
} from '../lib/utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting WhatsApp conversation merging script...');

  const instances = await prisma.whatsAppInstance.findMany();
  const conversations = await prisma.conversation.findMany({
    include: {
      messages: true,
      lead: true,
    },
  });

  console.log(`Found ${instances.length} WhatsApp instances and ${conversations.length} total conversations.`);

  const instanceMap = new Map(instances.map((i) => [i.id, i]));
  const conversationsByInstance = new Map<string, typeof conversations>();

  for (const conversation of conversations) {
    const list = conversationsByInstance.get(conversation.instanceId) || [];
    list.push(conversation);
    conversationsByInstance.set(conversation.instanceId, list);
  }

  let totalMerged = 0;

  for (const [instanceId, instConversations] of conversationsByInstance.entries()) {
    const instance = instanceMap.get(instanceId);
    const instanceName = instance?.name || '';
    console.log(`\nProcessing instance: "${instanceName}" (ID: ${instanceId})`);

    const groups: (typeof conversations)[] = [];

    for (const conversation of instConversations) {
      const variants = getPhoneVariants(conversation.whatsappId);
      const canUseNameKey = conversation.leadId || conversation.messages.some((message) => message.direction === 'INBOUND');
      const nameKey =
        canUseNameKey &&
        !isLikelyBrazilianPhoneId(conversation.whatsappId) &&
        !isGenericWhatsAppName(conversation.name, conversation.whatsappId, instanceName)
          ? normalizeContactName(conversation.name)
          : null;

      let foundGroup = false;

      for (const group of groups) {
        if (
          group.some((groupConversation) => {
            const canUseGroupNameKey =
              groupConversation.leadId ||
              groupConversation.messages.some((message) => message.direction === 'INBOUND');
            const groupNameKey =
              canUseGroupNameKey &&
              !isLikelyBrazilianPhoneId(groupConversation.whatsappId) &&
              !isGenericWhatsAppName(groupConversation.name, groupConversation.whatsappId, instanceName)
                ? normalizeContactName(groupConversation.name)
                : null;

            return (
              variants.includes(groupConversation.whatsappId) ||
              getPhoneVariants(groupConversation.whatsappId).includes(conversation.whatsappId) ||
              (!!nameKey && nameKey === groupNameKey)
            );
          })
        ) {
          group.push(conversation);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        groups.push([conversation]);
      }
    }

    for (const group of groups) {
      if (group.length <= 1) continue;

      console.log(`\nFound group with ${group.length} duplicate conversations:`);
      for (const conversation of group) {
        console.log(
          `  - Conv ID: ${conversation.id}, whatsappId: ${conversation.whatsappId}, name: "${conversation.name}", lead: ${conversation.lead?.name || 'none'}, messages: ${conversation.messages.length}`
        );
      }

      const scoredConversations = group.map((conversation) => {
        let score = 0;
        const isGenericName = isGenericWhatsAppName(conversation.name, conversation.whatsappId, instanceName);

        if (!isGenericName) score += 100;
        if (conversation.leadId) score += 50;
        score += conversation.messages.length;

        return { conversation, score };
      });

      scoredConversations.sort((a, b) => b.score - a.score);
      const primary = scoredConversations[0].conversation;
      const redundantList = scoredConversations.slice(1).map((sc) => sc.conversation);

      console.log(`Selected PRIMARY conversation: "${primary.name}" (ID: ${primary.id})`);

      let updatedLeadId = primary.leadId;
      let updatedName = primary.name;
      let updatedLastMessageAt = new Date(primary.lastMessageAt);

      for (const redundant of redundantList) {
        console.log(`Merging redundant conversation "${redundant.name}" (ID: ${redundant.id}) -> Primary`);

        if (redundant.messages.length > 0) {
          const moveResult = await prisma.message.updateMany({
            where: { conversationId: redundant.id },
            data: { conversationId: primary.id },
          });
          console.log(`  Moved ${moveResult.count} messages.`);
        }

        if (!updatedLeadId && redundant.leadId) {
          updatedLeadId = redundant.leadId;
          console.log(`  Inherited lead ID: ${redundant.leadId}`);
        }

        const primaryIsGeneric = isGenericWhatsAppName(updatedName, primary.whatsappId, instanceName);
        const redundantIsGeneric = isGenericWhatsAppName(redundant.name, redundant.whatsappId, instanceName);

        if (primaryIsGeneric && !redundantIsGeneric) {
          updatedName = redundant.name;
          console.log(`  Inherited contact name: "${redundant.name}"`);
        }

        const redundantDate = new Date(redundant.lastMessageAt);
        if (redundantDate > updatedLastMessageAt) {
          updatedLastMessageAt = redundantDate;
        }

        await prisma.conversation.delete({
          where: { id: redundant.id },
        });
        console.log('  Deleted redundant conversation.');
      }

      await prisma.conversation.update({
        where: { id: primary.id },
        data: {
          leadId: updatedLeadId,
          name: updatedName,
          lastMessageAt: updatedLastMessageAt,
        },
      });

      console.log(`Successfully updated primary conversation "${updatedName}"`);
      totalMerged++;
    }
  }

  console.log(`\nWhatsApp conversation merging completed. Total groups merged: ${totalMerged}`);
}

main()
  .catch((error) => {
    console.error('Error during merging script:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
